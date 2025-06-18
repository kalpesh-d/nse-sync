// Helper functions for dashboard calculations and formatting

export function calculatePageRange(page, itemsPerPage, totalRecords) {
  const start = ((page - 1) * itemsPerPage) + 1
  const end = Math.min(page * itemsPerPage, totalRecords)
  return { start, end }
}

export function formatPageDescription(page, itemsPerPage, totalRecords) {
  const start = ((page - 1) * itemsPerPage) + 1
  const end = Math.min(page * itemsPerPage, totalRecords)
  return `Showing ${start} to ${end} of ${totalRecords} records`
}

export function getLastLogUpdate(downloadLogs) {
  return downloadLogs.length > 0 ? new Date(downloadLogs[0].created_at) : null
}

export function getDisplayDataCount(data, showAll, itemsPerPage) {
  return showAll ? data.length : Math.min(data.length, itemsPerPage)
}

export function parseSearchParams(searchParams) {
  return {
    page: parseInt(searchParams?.page) || 1,
    tab: searchParams?.tab || 'overview'
  }
} 