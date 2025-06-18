const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Ensure dotenv is loaded to access environment variables

puppeteer.use(StealthPlugin()); // Enable the stealth plugin for anti-bot evasion


const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('FATAL ERROR: Supabase URL or Anon Key not found in environment variables. Please check your .env file.');
  process.exit(1); // Exit process if critical environment variables are missing
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Helper function to parse NSE date/time strings into ISO 8601 ---
function parseNseDateTime(nseDateTimeStr) {
  if (!nseDateTimeStr) return null;

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

  const date = new Date(year, month, day, hour, minute, second);
  return date.toISOString();
}

async function fetchDataAndUpsertToSupabase() {
  let browser; // Declare browser outside try for finally block access
  let page;    // Declare page outside try for finally block access

  try {
    console.log(`[${new Date().toISOString()}] Starting data fetch and upsert...`);

    // --- Puppeteer Launch Configuration ---
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-features=IsolateOrigins,site-per-process',
        '--lang=en-US,en',
      ]
    });
    page = await browser.newPage();

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
      'Referer': warmUpUrl
    });

    let apiResponseData = null;

    console.log('Step 1: Navigating to warm-up URL to establish session...');
    await page.goto(warmUpUrl, { waitUntil: 'networkidle2' });
    console.log('Step 1 complete: Session likely established.');

    // --- Step 2: Fetch Data from API URL using waitForResponse ---
    console.log('Step 2: Navigating to API URL to fetch data...');

    const [apiResponse] = await Promise.all([
      page.waitForResponse(response => response.url() === apiUrl && response.ok(), { timeout: 30000 }),
      page.goto(apiUrl, { waitUntil: 'domcontentloaded' })
    ]);

    if (apiResponse) {
      try {
        apiResponseData = await apiResponse.json();
        console.log('JSON data captured successfully from API response!');
      } catch (error) {
        console.error('ERROR: Could not parse JSON from API response. It might not be valid JSON:', error);
        apiResponseData = null;
      }
    } else {
      console.error('ERROR: API response not captured or was not OK after navigation.');
      apiResponseData = null;
    }

    if (apiResponseData && Array.isArray(apiResponseData)) {
      const corporateAnnouncements = apiResponseData;
      console.log(`Fetched ${corporateAnnouncements.length} announcements.`);

      const tableName = 'equities_data';

      const formattedData = corporateAnnouncements.map(item => {
        const broadcastDateTime = parseNseDateTime(item.an_dt);
        const receiptDateTime = parseNseDateTime(item.an_dt);
        const disseminationDateTime = parseNseDateTime(item.exchdisstime);

        let differenceInterval = null;
        if (item.difference) {
          differenceInterval = item.difference.includes(':') ? item.difference : `${item.difference} seconds`;
        } else if (receiptDateTime && disseminationDateTime) {
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
          ignoreDuplicates: false // Set to true if you only want to insert new, not update existing
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
    console.log(`[${new Date().toISOString()}] Data fetch and upsert finished.`);
  }
}

let isProcessing = false; // Flag to prevent concurrent runs
const INTERVAL_MINUTES = 15;
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;

async function runScheduledJob() {
  if (isProcessing) {
    console.log(`[${new Date().toISOString()}] Previous job still running. Skipping current scheduled run.`);
    return;
  }

  isProcessing = true;
  try {
    await fetchDataAndUpsertToSupabase();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error during scheduled job execution:`, error);
  } finally {
    isProcessing = false; // Reset flag whether successful or not
  }
}


console.log(`[${new Date().toISOString()}] Initializing NSE scraper. Running first job now.`);
runScheduledJob();

console.log(`[${new Date().toISOString()}] Scheduling job to run every ${INTERVAL_MINUTES} minutes.`);
setInterval(runScheduledJob, INTERVAL_MS);