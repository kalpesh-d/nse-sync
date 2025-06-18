import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getStatusIcon } from '@/lib/utils'
import { format } from 'date-fns'

const StatItem = ({ label, value, className = '' }) => (
  <div className="flex justify-between items-center">
    <span className="text-sm font-medium">{label}</span>
    <span className={`text-lg font-bold ${className}`}>{value}</span>
  </div>
)

export default function Statistics({ stats, downloadLogs }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Database Statistics</CardTitle>
          <CardDescription>Comprehensive overview of the database</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatItem label="Total Records:" value={stats.totalRecords} />
          <StatItem label="New Today:" value={`+${stats.newEntriesToday}`} className="text-green-600" />
          <StatItem label="New This Week:" value={`+${stats.newEntriesThisWeek}`} className="text-blue-600" />
          <StatItem
            label="Last Updated:"
            value={stats.lastUpdated ? format(new Date(stats.lastUpdated), 'MMM dd, yyyy HH:mm') : 'Never'}
            className="text-sm text-muted-foreground"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest download and sync activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {downloadLogs.slice(0, 5).map((log, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(log.status)}
                  <span className="text-sm">{log.message}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(log.created_at), 'HH:mm')}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 