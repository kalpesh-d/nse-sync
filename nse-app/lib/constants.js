// Dashboard configuration constants
export const ITEMS_PER_PAGE = 10
export const DEFAULT_PAGE = 1
export const DEFAULT_TAB = 'overview'

// API endpoints
export const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
export const STATS_API_ENDPOINT = `${API_BASE_URL}/api/stats`
export const LOGS_API_ENDPOINT = `${API_BASE_URL}/api/logs`

// Database table names 
export const EQUITIES_DATA_TABLE = 'equities_data' 