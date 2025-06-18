'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'

// Import data fetching methods
import { getData, getStats, getDownloadLogs } from '@/lib/data'

// Import constants and helpers
import { ITEMS_PER_PAGE, DEFAULT_PAGE, DEFAULT_TAB } from '@/lib/constants'
import { formatPageDescription, getDisplayDataCount } from '@/lib/helpers'

// Import components
import StatsCards from './StatsCards'
import DataTable from './DataTable'
import DownloadLogs from './DownloadLogs'
import Statistics from './Statistics'
import Pagination from './Pagination'
import RealtimeIndicator from './RealtimeIndicator'
import { Button } from '@/components/ui/button'

export default function Dashboard() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(DEFAULT_PAGE)
  const [totalPages, setTotalPages] = useState(0)
  const [totalRecords, setTotalRecords] = useState(0)
  const [stats, setStats] = useState({
    totalRecords: 0,
    lastUpdated: null,
    newEntriesToday: 0,
    newEntriesThisWeek: 0
  })
  const [downloadLogs, setDownloadLogs] = useState([])
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const [lastLogUpdate, setLastLogUpdate] = useState(null)

  // Fetch data from server-side functions
  const fetchData = async (page = 1) => {
    try {
      setLoading(true)
      const result = await getData(page)
      setData(result.data)
      setTotalPages(result.totalPages)
      setTotalRecords(result.totalRecords)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const statsData = await getStats()
      setStats(statsData)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchDownloadLogs = async () => {
    try {
      const logs = await getDownloadLogs()
      setDownloadLogs(logs)
      if (logs?.length > 0) {
        setLastLogUpdate(new Date())
      }
    } catch (error) {
      console.error('Error fetching download logs:', error)
    }
  }

  // Setup realtime subscription for download logs
  useEffect(() => {
    const channel = supabase
      .channel('download_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'download_logs'
        },
        () => {
          setLastLogUpdate(new Date())
          fetchDownloadLogs()
          fetchStats()
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Load data on component mount and page change
  useEffect(() => {
    fetchData(currentPage)
    fetchStats()
    fetchDownloadLogs()
  }, [currentPage])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">NSE Corporate Announcements</h1>
        <RealtimeIndicator isConnected={isRealtimeConnected} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="logs">Download Logs</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <StatsCards stats={stats} />

          <Card>
            <CardHeader>
              <CardTitle>Recent Corporate Announcements</CardTitle>
              <CardDescription>
                Latest {getDisplayDataCount(data, false, ITEMS_PER_PAGE)} records from the database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable data={data} loading={loading} showAll={false} />
              {data.length > 5 && (
                <div className="mt-4 text-center">
                  <Button variant="outline" onClick={() => setActiveTab('database')}>
                    View All Records
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Entire Database</CardTitle>
              <CardDescription>
                {formatPageDescription(currentPage, ITEMS_PER_PAGE, totalRecords)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable data={data} loading={loading} showAll={true} />
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <DownloadLogs
            downloadLogs={downloadLogs}
            lastLogUpdate={lastLogUpdate}
            getRealtimeIndicator={() => <RealtimeIndicator isConnected={isRealtimeConnected} />}
          />
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          <Statistics stats={stats} downloadLogs={downloadLogs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}