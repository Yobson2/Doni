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

// Soft status styles built only from semantic tokens (see src/index.css).
// Text on each *-subtle tint passes WCAG AA in light and dark mode.
const tone = {
  success: "bg-success-subtle text-success border-success/30",
  warning: "bg-warning-subtle text-warning border-warning/30",
  danger: "bg-destructive-subtle text-destructive border-destructive/30",
  info: "bg-info-subtle text-info border-info/30",
  brand: "bg-secondary text-secondary-foreground border-primary/20",
  neutral: "bg-muted text-muted-foreground border-border",
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variants: Record<string, string> = {
    active: tone.success,
    approved: tone.success,
    new: tone.brand,
    pending: tone.warning,
    processing: tone.info,
    inactive: tone.neutral,
    completed: tone.neutral,
    cancelled: tone.danger,
    rejected: tone.danger,
  }

  const statusKey = status.toLowerCase()
  const variant = variants[statusKey] || tone.neutral

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
