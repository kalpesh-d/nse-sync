'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { RefreshCw, Database, Clock, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [stats, setStats] = useState({
    totalRecords: 0,
    lastUpdated: null
  })

  const itemsPerPage = 10

  // Fetch data from Supabase
  const fetchData = async (page = 1) => {
    try {
      setLoading(true)
      const from = (page - 1) * itemsPerPage
      const to = from + itemsPerPage - 1

      const { data: records, error } = await supabase
        .from('equities_data')
        .select('*')
        // .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error
      setData(records || [])

      // Get total count
      const { count } = await supabase
        .from('equities_data')
        .select('*', { count: 'exact', head: true })

      setStats(prev => ({
        ...prev,
        totalRecords: count || 0,
        lastUpdated: new Date().toISOString()
      }))

      setTotalPages(Math.ceil((count || 0) / itemsPerPage))
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(currentPage)
  }, [currentPage])

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">NSE Corporate Announcements</h1>
        <Button
          onClick={() => fetchData(currentPage)}
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRecords}</div>
            <p className="text-xs text-muted-foreground">
              Corporate announcements in database
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.lastUpdated ? format(new Date(stats.lastUpdated), 'HH:mm') : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.lastUpdated ? format(new Date(stats.lastUpdated), 'MMM dd, yyyy') : 'No data loaded'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Corporate Announcements</CardTitle>
          <CardDescription>
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, stats.totalRecords)} of {stats.totalRecords} records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading from Supabase...</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Broadcast Date</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Attachment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No data found in database.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.map((record, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{record.SYMBOL}</TableCell>
                          <TableCell>{record['COMPANY NAME']}</TableCell>
                          <TableCell className="max-w-xs">{record.SUBJECT}</TableCell>
                          <TableCell>
                            {record['BROADCAST DATE/TIME']
                              ? format(new Date(record['BROADCAST DATE/TIME']), 'MMM dd, yyyy HH:mm')
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            {record.DETAILS}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {record.ATTACHMENT ? (
                              <Link href={record.ATTACHMENT} target="_blank" className="inline-flex items-center gap-1 hover:text-blue-600">
                                <FileText className="h-4 w-4" />
                                <span className="text-xs">View</span>
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}