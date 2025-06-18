import { Wifi, WifiOff } from 'lucide-react'

export default function RealtimeIndicator({ isConnected }) {
  return (
    <div className="flex items-center gap-2">
      {isConnected ? (
        <Wifi className="h-4 w-4 text-green-500 animate-pulse" />
      ) : (
        <WifiOff className="h-4 w-4 text-red-500" />
      )}
      <span className="text-xs text-muted-foreground">
        {isConnected ? 'Live' : 'Offline'}
      </span>
    </div>
  )
} 