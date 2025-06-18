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

async function logDownloadActivity(status, message, recordsAdded = 0, logId = null) {
  try {
    if (logId) {
      // Update existing log entry
      const { error } = await supabase
        .from('download_logs')
        .update({
          status: status,
          message: message,
          records_added: recordsAdded,
          updated_at: new Date().toISOString()
        })
        .eq('id', logId);

      if (error) {
        console.error('Error updating download activity log:', error);
      } else {
        console.log(`[LOG] ${status.toUpperCase()}: ${message} (${recordsAdded} records)`);
      }
    } else {
      // Create new log entry
      const { data, error } = await supabase
        .from('download_logs')
        .insert([
          {
            status: status,
            message: message,
            records_added: recordsAdded,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        console.error('Error logging download activity:', error);
        return null;
      } else {
        console.log(`[LOG] ${status.toUpperCase()}: ${message} (${recordsAdded} records)`);
        return data[0].id; // Return the log ID for future updates
      }
    }
  } catch (error) {
    console.error('Failed to log download activity:', error);
    return null;
  }
}

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
  let totalRecordsProcessed = 0;
  let operationMessage = '';
  let logId = null; // Track the log entry ID

  try {
    console.log(`[${new Date().toISOString()}] Starting data fetch and upsert...`);

    // Create initial log entry
    logId = await logDownloadActivity('info', 'Starting NSE data download process...', 0);
    console.log('[LOG] INFO: Starting NSE data download process (0 records)');

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
        operationMessage = 'Failed to parse JSON response from NSE API';
        await logDownloadActivity('error', operationMessage, 0, logId);
        apiResponseData = null;
        return;
      }
    } else {
      console.error('ERROR: API response not captured or was not OK after navigation.');
      operationMessage = 'Failed to capture API response from NSE';
      await logDownloadActivity('error', operationMessage, 0, logId);
      apiResponseData = null;
      return;
    }

    if (apiResponseData && Array.isArray(apiResponseData)) {
      const corporateAnnouncements = apiResponseData;
      console.log(`Fetched ${corporateAnnouncements.length} announcements.`);
      console.log(`[LOG] INFO: Successfully fetched ${corporateAnnouncements.length} announcements from NSE API (0 records)`);

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
          "BROADCAST_DATE_TIME": broadcastDateTime,
          "RECEIPT": receiptDateTime,
          "DISSEMINATION": disseminationDateTime,
          "DIFFERENCE": differenceInterval,
          "ATTACHMENT": item.attchmntFile || null,
          "FILE SIZE": item.fileSize || null
        };
      });

      // **Crucially, ensure this matches a UNIQUE constraint you've added to your table.**
      const conflictColumns = ['SYMBOL', 'SUBJECT', '"BROADCAST_DATE_TIME"'];
      console.log(`Attempting to upsert ${formattedData.length} records into Supabase table '${tableName}' 
                        using unique columns: ${conflictColumns.join(', ')}...`);

      const { data: upsertData, error: upsertError } = await supabase
        .from(tableName)
        .upsert(formattedData, {
          onConflict: conflictColumns.join(','),
          ignoreDuplicates: false // Set to true if you only want to insert new, not update existing
        });

      if (upsertError) {
        console.error('ERROR: Failed to upsert data to Supabase:', upsertError);
        if (upsertError.details) console.error('Supabase error details:', upsertError.details);
        if (upsertError.hint) console.error('Supabase error hint:', upsertError.hint);

        operationMessage = `Failed to upsert data to Supabase: ${upsertError.message}`;
        await logDownloadActivity('error', operationMessage, 0, logId);
      } else {
        console.log(`SUCCESS: Data successfully upserted to Supabase.`);

        // Calculate how many new records were actually added
        let newRecordsCount = formattedData.length;
        if (upsertData) {
          // If upsertData is returned, we can calculate the difference
          // For now, we'll use the total count as an approximation
          newRecordsCount = formattedData.length;
        }

        totalRecordsProcessed = newRecordsCount;
        operationMessage = `Successfully downloaded and processed ${formattedData.length} announcements`;

        // Update the log entry with success status
        await logDownloadActivity('success', operationMessage, totalRecordsProcessed, logId);
      }
    } else {
      console.log('Skipping Supabase upsert: No valid announcement data (expected array) received from NSE API.');
      if (apiResponseData) {
        console.log('Raw API Response Data Structure (for debugging):', Object.keys(apiResponseData));
      }

      operationMessage = 'No valid announcement data received from NSE API';
      await logDownloadActivity('warning', operationMessage, 0, logId);
    }

  } catch (error) {
    console.error('An unexpected error occurred during the scraping process:', error);

    operationMessage = `Unexpected error during scraping: ${error.message}`;
    await logDownloadActivity('error', operationMessage, 0, logId);
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
    await logDownloadActivity('warning', 'Previous job still running, skipping scheduled run', 0);
    return;
  }

  isProcessing = true;
  try {
    await fetchDataAndUpsertToSupabase();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error during scheduled job execution:`, error);
    await logDownloadActivity('error', `Scheduled job execution failed: ${error.message}`, 0);
  } finally {
    isProcessing = false; // Reset flag whether successful or not
  }
}

// Initialize the download_logs table if it doesn't exist
async function initializeLogsTable() {
  try {
    // Just check if the table exists by trying to select from it
    const { error } = await supabase
      .from('download_logs')
      .select('id')
      .limit(1);

    if (error) {
      console.warn('Download logs table may not exist. Please run the setup SQL script.');
      console.warn('Error details:', error.message);
    } else {
      console.log('Download logs table is ready for logging.');
    }
  } catch (error) {
    console.warn('Could not check download logs table:', error.message);
  }
}

// Initialize logging system
initializeLogsTable().then(() => {
  console.log(`[${new Date().toISOString()}] Initializing NSE scraper. Running first job now.`);
  runScheduledJob();

  console.log(`[${new Date().toISOString()}] Scheduling job to run every ${INTERVAL_MINUTES} minutes.`);
  setInterval(runScheduledJob, INTERVAL_MS);
});