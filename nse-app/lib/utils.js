import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"
import { AlertCircle, CheckCircle, Activity } from 'lucide-react'

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getStatusIcon(status) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />
    default:
      return <Activity className="h-4 w-4 text-yellow-500" />
  }
}
