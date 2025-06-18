const puppeteer = require('puppeteer');
const fs = require('fs');

async function fetchDataAndSaveToJson() {
  let browser;
  try {
    // Launch browser in headless mode. Set to false for debugging.
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox', // Recommended for better compatibility
        '--disable-setuid-sandbox', // Recommended for better compatibility
        '--disable-web-security', // Can sometimes help with CORS-like issues (use with caution)
        '--disable-features=IsolateOrigins,site-per-process' // Helps with certain isolation issues
      ]
    });
    const page = await browser.newPage();

    const apiUrl = 'https://www.nseindia.com/api/corporate-announcements?index=equities';

    // --- Important: Set realistic browser-like headers ---
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Referer': 'https://www.nseindia.com/corporate-announcements', // Crucial for NSE APIs
      'Sec-Fetch-Dest': 'empty', // Standard browser header for XHR
      'Sec-Fetch-Mode': 'cors', // Standard browser header for XHR
      'Sec-Fetch-Site': 'same-origin', // Standard browser header for XHR
      // 'Host': 'www.nseindia.com' // Often added automatically, but can be explicit
    });

    let jsonData = null;

    // Listen for the network response that matches our API URL
    page.on('response', async (response) => {
      if (response.url() === apiUrl) { // No need for resourceType: 'xhr' if you're only hitting an API directly
        // Ensure the status is successful (200 range)
        if (response.ok()) {
          try {
            jsonData = await response.json();
            console.log('JSON data captured from API response!');
          } catch (error) {
            console.error('Error parsing JSON from response:', error);
          }
        } else {
          console.error(`Non-OK response status from API: ${response.status()} ${response.statusText}`);
          // Optionally, log the response text for non-JSON errors
          // console.error('Response text:', await response.text());
        }
      }
    });

    console.log(`Navigating directly to API URL: ${apiUrl}`);
    // Use 'domcontentloaded' or an empty 'waitUntil' for API calls
    // 'domcontentloaded' waits for the initial HTML to be parsed, which is faster than networkidle2
    // and usually sufficient for simple API loads.
    await page.goto(apiUrl, { waitUntil: 'domcontentloaded' });

    // Give some time for the response listener to definitely catch the data
    // This is a crucial step after page.goto to ensure the response is processed
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for 3 seconds

    if (jsonData) {
      const filePath = 'corporate_announcements.json';
      fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
      console.log(`Data successfully saved to ${filePath}`);
    } else {
      console.log('No JSON data was captured or an error occurred during capture.');
      console.log('Consider debugging with headless: false to see browser behavior.');
    }

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

fetchDataAndSaveToJson();