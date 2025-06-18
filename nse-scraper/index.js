const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

puppeteer.use(StealthPlugin()); // Enable the stealth plugin for anti-bot evasion

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('FATAL ERROR: Supabase URL or Anon Key not found in environment variables. Please check your .env file.');
  process.exit(1); // Exit process if critical environment variables are missing
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Helper function to parse NSE date/time strings into ISO 8601 ---
// Example NSE format: "18-Jun-2025 16:57:38"
// This format is parsed into a Date object, then converted to an ISO 8601 string
// (e.g., "2025-06-18T11:27:38.000Z") which PostgreSQL TIMESTAMP WITH TIME ZONE handles well.
function parseNseDateTime(nseDateTimeStr) {
  if (!nseDateTimeStr) return null;

  // Regex to extract day, month (short), year, hour, minute, second
  const parts = nseDateTimeStr.match(/(\d{2})-(\w{3})-(\d{4})\s(\d{2}):(\d{2}):(\d{2})/);
  if (!parts) {
    console.warn(`Warning: Could not parse date/time string: "${nseDateTimeStr}"`);
    return null;
  }

  const [_, day, monthStr, year, hour, minute, second] = parts;
  const monthMap = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  const month = monthMap[monthStr];

  // Create a Date object. Note: Month is 0-indexed in JavaScript Date constructor.
  const date = new Date(year, month, day, hour, minute, second);
  return date.toISOString();
}

async function fetchDataAndUpsertToSupabase() {
  let browser; // Declare browser outside try for finally block access
  let page;    // Declare page outside try for finally block access

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',             // Essential for Docker/server environments
        '--disable-setuid-sandbox', // Recommended security sandbox disables
        '--disable-features=IsolateOrigins,site-per-process', // Can help with some site isolation issues
        '--lang=en-US,en',          // Mimic browser language settings
        // '--disable-blink-features=AutomationControlled' is handled by stealth plugin
      ]
    });
    page = await browser.newPage();

    const apiUrl = 'https://www.nseindia.com/api/corporate-announcements?index=equities';
    const warmUpUrl = 'https://www.nseindia.com/corporate-announcements';

    // Set realistic browser-like headers to further mimic a real user
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'Referer': warmUpUrl // Explicitly set Referer for API call if it doesn't automatically propagate
    });

    let apiResponseData = null; // Variable to hold the parsed JSON from the API

    console.log(`Step 1: Navigating to warm-up URL: ${warmUpUrl} to establish session...`);
    await page.goto(warmUpUrl, { waitUntil: 'networkidle2' }); // Wait until no more than 2 network connections for at least 500ms
    console.log('Step 1 complete: Session likely established.');

    console.log(`Step 2: Navigating to API URL: ${apiUrl} to fetch data...`);

    // 1. Wait for the specific API response (success or failure)
    // 2. Navigate the page to the API URL
    const [apiResponse] = await Promise.all([
      // Wait for a response where the URL matches our API and the status is OK (200)
      page.waitForResponse(response => response.url() === apiUrl && response.ok(), { timeout: 30000 }), // 30s timeout
      page.goto(apiUrl, { waitUntil: 'domcontentloaded' }) // 'domcontentloaded' is usually sufficient for API calls
    ]);

    if (apiResponse) {
      try {
        apiResponseData = await apiResponse.json();
        console.log('JSON data captured successfully from API response!');
      } catch (error) {
        console.error('ERROR: Could not parse JSON from API response. It might not be valid JSON:', error);
        apiResponseData = null; // Ensure apiResponseData is null if parsing fails
      }
    } else {
      console.error('ERROR: API response not captured or was not OK after navigation.');
      apiResponseData = null;
    }

    // Only proceed if we have valid, parsed API data and it's an array
    if (apiResponseData && Array.isArray(apiResponseData)) {
      const corporateAnnouncements = apiResponseData;
      console.log(`Fetched ${corporateAnnouncements.length} announcements.`);

      const tableName = 'equities_data';

      const formattedData = corporateAnnouncements.map(item => {
        // Map API fields to your Supabase table columns (case-sensitive as per your DDL)
        const broadcastDateTime = parseNseDateTime(item.an_dt);
        const receiptDateTime = parseNseDateTime(item.an_dt);
        const disseminationDateTime = parseNseDateTime(item.exchdisstime);

        // Handle DIFFERENCE: use provided field if valid, else calculate
        let differenceInterval = null;
        if (item.difference) {
          // Check if it's already HH:MM:SS or just seconds (e.g., "00:00:01" or "1")
          differenceInterval = item.difference.includes(':') ? item.difference : `${item.difference} seconds`;
        } else if (receiptDateTime && disseminationDateTime) {
          // Fallback calculation: (Dissemination - Receipt) in seconds
          const diffMs = new Date(disseminationDateTime).getTime() - new Date(receiptDateTime).getTime();
          const seconds = Math.floor(diffMs / 1000);
          differenceInterval = `${seconds} seconds`;
        }

        return {
          "SYMBOL": item.symbol,
          "COMPANY NAME": item.sm_name || null,
          "SUBJECT": item.desc,
          "DETAILS": item.attchmntText || null,
          "BROADCAST DATE/TIME": broadcastDateTime,
          "RECEIPT": receiptDateTime,
          "DISSEMINATION": disseminationDateTime,
          "DIFFERENCE": differenceInterval,
          "ATTACHMENT": item.attchmntFile || null,
          "FILE SIZE": item.fileSize || null
        };
      });

      // **Crucially, ensure this matches a UNIQUE constraint you've added to your table.**
      const conflictColumns = ['SYMBOL', 'SUBJECT', '"BROADCAST DATE/TIME"'];
      console.log(`Attempting to upsert ${formattedData.length} records into Supabase table '${tableName}' 
                        using unique columns: ${conflictColumns.join(', ')}...`);

      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(formattedData, {
          onConflict: conflictColumns.join(','),
          ignoreDuplicates: true // Set to true if you only want to insert new, not update existing
        });

      if (upsertError) {
        console.error('ERROR: Failed to upsert data to Supabase:', upsertError);
        if (upsertError.details) console.error('Supabase error details:', upsertError.details);
        if (upsertError.hint) console.error('Supabase error hint:', upsertError.hint);
      } else {
        console.log(`SUCCESS: Data successfully upserted to Supabase.`);
      }
    } else {
      console.log('Skipping Supabase upsert: No valid announcement data (expected array) received from NSE API.');
      if (apiResponseData) {
        console.log('Raw API Response Data Structure (for debugging):', Object.keys(apiResponseData));
      }
    }

  } catch (error) {
    console.error('An unexpected error occurred during the scraping process:', error);
  } finally {
    if (page) {
      try {
        await page.close();
        console.log('Puppeteer page closed.');
      } catch (err) {
        console.error('Error closing page:', err);
      }
    }
    if (browser) {
      try {
        await browser.close();
        console.log('Puppeteer browser closed.');
      } catch (err) {
        console.error('Error closing browser:', err);
      }
    }
  }
}

fetchDataAndUpsertToSupabase();