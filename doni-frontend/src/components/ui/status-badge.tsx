import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StatusType = 
  | "active" 
  | "pending" 
  | "inactive" 
  | "new" 
  | "completed" 
  | "cancelled"
  | "approved"
  | "rejected"
  | string

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variants: Record<string, string> = {
    active: "bg-success-50 text-success-700 border-success-200",
    new: "bg-primary-50 text-primary-700 border-primary-200",
    pending: "bg-warning-50 text-warning-700 border-warning-200",
    processing: "bg-purple-50 text-purple-700 border-purple-200",
    inactive: "bg-danger-50 text-danger-700 border-danger-200",
    cancelled: "bg-danger-50 text-danger-700 border-danger-200",
    rejected: "bg-danger-50 text-danger-700 border-danger-200",
    completed: "bg-gray-100 text-gray-700 border-gray-200",
    approved: "bg-success-50 text-success-700 border-success-200",
  }

  const statusKey = status.toLowerCase()
  const variant = variants[statusKey] || "bg-gray-100 text-gray-700 border-gray-200"

  return (
    <Badge 
      className={cn(
        "font-medium border rounded-md capitalize px-2.5 py-1", 
        variant, 
        className
      )}
    >
      {status}
    </Badge>
  )
} 