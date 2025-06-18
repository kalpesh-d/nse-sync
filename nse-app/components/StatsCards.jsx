import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, Clock, Download, Activity } from 'lucide-react'
import { format } from 'date-fns'

const StatCard = ({ title, value, description, icon: Icon, valueClassName = '' }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${valueClassName}`}>{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
)

export default function StatsCards({ stats }) {
  const cards = [
    {
      title: 'Total Records',
      value: stats.totalRecords,
      description: 'Corporate announcements in database',
      icon: Database
    },
    {
      title: 'New Today',
      value: stats.newEntriesToday,
      description: 'Entries added today',
      icon: Download,
      valueClassName: 'text-green-600'
    },
    {
      title: 'New This Week',
      value: stats.newEntriesThisWeek,
      description: 'Entries added this week',
      icon: Activity,
      valueClassName: 'text-blue-600'
    },
    {
      title: 'Last Updated',
      value: stats.lastUpdated ? format(new Date(stats.lastUpdated), 'HH:mm') : 'Never',
      description: stats.lastUpdated ? format(new Date(stats.lastUpdated), 'MMM dd, yyyy') : 'No data loaded',
      icon: Clock
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <StatCard key={index} {...card} />
      ))}
    </div>
  )
} 