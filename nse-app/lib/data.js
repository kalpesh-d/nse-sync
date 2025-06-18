import { supabase } from '@/lib/supabase'
import {
  ITEMS_PER_PAGE,
  STATS_API_ENDPOINT,
  LOGS_API_ENDPOINT,
  EQUITIES_DATA_TABLE
} from './constants'


export async function getData(page = 1) {
  const from = (page - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1

  try {
    const { data: records, error } = await supabase
      .from(EQUITIES_DATA_TABLE)
      .select('*')
      .order('BROADCAST_DATE_TIME', { ascending: false })
      .range(from, to)

    if (error) throw error

    // Get total count
    const { count } = await supabase
      .from(EQUITIES_DATA_TABLE)
      .select('*', { count: 'exact', head: true })

    return {
      data: records || [],
      totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
      totalRecords: count || 0
    }
  } catch (error) {
    console.error('Error fetching data:', error)
    return { data: [], totalPages: 0, totalRecords: 0 }
  }
}

export async function getStats() {
  try {
    const response = await fetch(STATS_API_ENDPOINT)
    if (response.ok) {
      return await response.json()
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
  }
  return {
    totalRecords: 0,
    lastUpdated: null,
    newEntriesToday: 0,
    newEntriesThisWeek: 0
  }
}

export async function getDownloadLogs() {
  try {
    const response = await fetch(LOGS_API_ENDPOINT)
    if (response.ok) {
      const { logs } = await response.json()
      return logs || []
    }
  } catch (error) {
    console.error('Error fetching download logs:', error)
  }
  return []
} 