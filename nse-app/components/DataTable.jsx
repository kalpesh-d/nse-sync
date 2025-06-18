import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileText } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

export default function DataTable({ data, loading, showAll = false }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
        <span className="ml-2">Loading...</span>
      </div>
    )
  }

  const displayData = showAll ? data : data.slice(0, 5)

  if (!displayData.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data found in database.
      </div>
    )
  }

  return (
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
          {displayData.map((record, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{record.SYMBOL}</TableCell>
              <TableCell>{record['COMPANY NAME']}</TableCell>
              <TableCell className="max-w-xs">{record.SUBJECT}</TableCell>
              <TableCell className="text-nowrap">
                {record['BROADCAST_DATE_TIME']
                  ? format(new Date(record['BROADCAST_DATE_TIME']), 'MMM dd, yyyy HH:mm')
                  : '-'
                }
              </TableCell>
              <TableCell className="max-w-md">{record.DETAILS}</TableCell>
              <TableCell>
                {record.ATTACHMENT ? (
                  <Link href={record.ATTACHMENT} target="_blank" className="inline-flex items-center gap-1 hover:text-blue-600 text-xs">
                    <FileText className="h-4 w-4" />
                    View
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
} 