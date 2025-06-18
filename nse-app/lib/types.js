/**
 * Type definitions for the NSE Dashboard application
 */

/**
 * @typedef {Object} DashboardData
 * @property {Array} data - Array of equity records
 * @property {number} totalPages - Total number of pages
 * @property {number} totalRecords - Total number of records
 */

/**
 * @typedef {Object} Stats
 * @property {number} totalRecords - Total number of records in database
 * @property {string|null} lastUpdated - Last update timestamp
 * @property {number} newEntriesToday - New entries added today
 * @property {number} newEntriesThisWeek - New entries added this week
 */

/**
 * @typedef {Object} DownloadLog
 * @property {string} status - Log status (success, error, warning, info)
 * @property {string} message - Log message
 * @property {number} records_added - Number of records added
 * @property {string} created_at - Creation timestamp
 */

/**
 * @typedef {Object} SearchParams
 * @property {string} page - Current page number
 * @property {string} tab - Current active tab
 */

/**
 * @typedef {Object} EquityRecord
 * @property {string} SYMBOL - Stock symbol
 * @property {string} COMPANY_NAME - Company name
 * @property {string} SUBJECT - Announcement subject
 * @property {string} BROADCAST_DATE_TIME - Broadcast date and time
 * @property {string} DETAILS - Announcement details
 * @property {string|null} ATTACHMENT - Attachment URL
 */ 