import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getStatusIcon } from '@/lib/utils'
import { format } from 'date-fns'

const statusBadgeStyles = {
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-gray-100 text-gray-800'
}

export default function DownloadLogs({ downloadLogs, lastLogUpdate, getRealtimeIndicator }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Download Logs</CardTitle>
            <CardDescription>
              Recent download activity and synchronization logs
              {lastLogUpdate && (
                <span className="ml-2 text-xs text-green-600">
                  • Last updated: {format(lastLogUpdate, 'HH:mm:ss')}
                </span>
              )}
            </CardDescription>
          </div>
          {getRealtimeIndicator()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!downloadLogs.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No download logs found.
            </div>
          ) : (
            downloadLogs.map((log, index) => (
              <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(log.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{log.message}</p>
                    <div className="flex items-center space-x-2">
                      <Badge className={statusBadgeStyles[log.status] || statusBadgeStyles.info}>
                        {log.status}
                      </Badge>
                      {log.records_added > 0 && (
                        <Badge variant="outline" className="text-xs">
                          +{log.records_added} records
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
} 