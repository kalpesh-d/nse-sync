const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'nse-scraper'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'NSE Scraper is running',
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`NSE Scraper server running on port ${PORT}`);
});

// Import and start the scraper
require('./index.js'); 