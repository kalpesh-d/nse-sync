const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

puppeteer.use(StealthPlugin());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Supabase URL or Anon Key not found in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to parse NSE date/time strings into ISO 8601 for TIMESTAMP WITH TIME ZONE
function parseNseDateTime(nseDateTimeStr) {
  if (!nseDateTimeStr) return null;
  // Example NSE format: "18-Jun-2025 16:57:38"
  const parts = nseDateTimeStr.match(/(\d{2})-(\w{3})-(\d{4})\s(\d{2}):(\d{2}):(\d{2})/);
  if (!parts) return null;

  const [_, day, monthStr, year, hour, minute, second] = parts;
  const monthMap = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  const month = monthMap[monthStr];

  // Create a Date object in local time and convert to ISO string.
  // Supabase TIMESTAMP WITH TIME ZONE is flexible, but ISO string is best practice.
  // Note: JS Date constructor handles month (0-11) correctly
  const date = new Date(year, month, day, hour, minute, second);
  return date.toISOString(); // e.g., "2025-06-18T11:27:38.000Z" (adjusted for timezone)
}

async function fetchDataAndUpsertToSupabase() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true, // Keep true for backend deployment
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-features=IsolateOrigins,site-per-process',
        '--lang=en-US,en',
        '--disable-blink-features=AutomationControlled'
      ]
    });
    const page = await browser.newPage();

    const apiUrl = 'https://www.nseindia.com/api/corporate-announcements?index=equities';
    const warmUpUrl = 'https://www.nseindia.com/corporate-announcements';

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    });

    let apiResponseData = null;

    page.on('response', async (response) => {
      if (response.url() === apiUrl) {
        if (response.ok()) {
          try {
            apiResponseData = await response.json();
            console.log('JSON data captured from API response!');
            // Optional: Keep debugging line for full output if needed later
            // console.log('--- Full API Response Data (for debugging) ---');
            // console.log(JSON.stringify(apiResponseData, null, 2));
            // console.log('-------------------------------------------');
          } catch (error) {
            console.error('Error parsing JSON from response:', error);
          }
        } else {
          console.error(`Non-OK response status from API: ${response.status()} ${response.statusText}`);
        }
      }
    });

    console.log(`Step 1: Navigating to warm-up URL: ${warmUpUrl} to establish session...`);
    await page.goto(warmUpUrl, { waitUntil: 'networkidle2' });
    console.log('Step 1 complete: Session likely established.');

    console.log(`Step 2: Navigating to API URL: ${apiUrl} to fetch data...`);
    await page.goto(apiUrl, { waitUntil: 'domcontentloaded' });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // --- CORRECTED LOGIC HERE ---
    // The API response is directly an array, not an object with a 'data' key
    if (apiResponseData && Array.isArray(apiResponseData)) {
      const corporateAnnouncements = apiResponseData; // Directly use apiResponseData as the array
      console.log(`Fetched ${corporateAnnouncements.length} announcements.`);

      const tableName = 'equities_data';

      const formattedData = corporateAnnouncements.map(item => {
        // Parse dates. NSE fields as observed in your output: an_dt, exchdisstime
        const broadcastDateTime = parseNseDateTime(item.an_dt); // 'an_dt' looks like broadcast time
        const receiptDateTime = parseNseDateTime(item.an_dt); // Assuming receipt is same as an_dt unless another field indicates it
        const disseminationDateTime = parseNseDateTime(item.exchdisstime); // 'exchdisstime' looks like dissemination time

        // Calculate difference for INTERVAL type
        let differenceInterval = null;
        // If the 'difference' field is already a string like "00:00:00" or "00:00:01", use it directly.
        // PostgreSQL INTERVAL can often parse "HH:MM:SS" or "X seconds".
        if (item.difference) {
          differenceInterval = item.difference.includes(':') ? item.difference : `${item.difference} seconds`;
        } else if (receiptDateTime && disseminationDateTime) {
          // Fallback to calculation if 'difference' field is not present or usable
          const diffMs = new Date(disseminationDateTime).getTime() - new Date(receiptsDateTime).getTime();
          const seconds = Math.floor(diffMs / 1000);
          differenceInterval = `${seconds} seconds`;
        }

        return {
          // Mapping observed JSON fields to your Supabase table columns (case-sensitive)
          "SYMBOL": item.symbol,
          "COMPANY NAME": item.sm_name || null, // 'sm_name' seems to be company name
          "SUBJECT": item.desc, // 'desc' seems to be the subject
          "DETAILS": item.attchmntText || null, // 'attchmntText' seems to be the details
          "BROADCAST DATE/TIME": broadcastDateTime,
          "RECEIPT": receiptDateTime, // Using an_dt as receipt for now, adjust if you find a specific receipt time field
          "DISSEMINATION": disseminationDateTime,
          "DIFFERENCE": differenceInterval,
          "ATTACHMENT": item.attchmntFile || null, // 'attchmntFile' is the attachment link
          "FILE SIZE": item.fileSize || null // 'fileSize' is the file size
        };
      });

      // Define the columns that uniquely identify an announcement for onConflict.
      // Based on the new data: SYMBOL, SUBJECT (desc), BROADCAST DATE/TIME (an_dt) seem suitable.
      const conflictColumns = ['SYMBOL', 'SUBJECT', '"BROADCAST DATE/TIME"']; // Use quotes for columns with spaces
      console.log(`Attempting to upsert ${formattedData.length} records into Supabase table '${tableName}' 
                        using unique columns: ${conflictColumns.join(', ')}...`);

      const { data, error } = await supabase
        .from(tableName)
        .upsert(formattedData, {
          onConflict: conflictColumns.join(','),
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error upserting data to Supabase:', error);
        if (error.details) console.error('Supabase error details:', error.details);
        if (error.hint) console.error('Supabase error hint:', error.hint);
      } else {
        console.log(`Successfully upserted data to Supabase.`);
      }
    } else {
      console.log('No valid announcement data (array) received from NSE API.');
      if (apiResponseData) {
        console.log('Raw API Response Data Structure (for debugging):', Object.keys(apiResponseData));
      } else {
        console.log('apiResponseData was null or undefined.');
      }
    }

  } catch (error) {
    console.error('An error occurred during the scraping or Supabase operation:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

fetchDataAndUpsertToSupabase();