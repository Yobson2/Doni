// import React from "react"
import { Button } from "@/components/ui/button"
import { 
  IconChevronLeft, 
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight
} from "@tabler/icons-react"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface TablePaginationProps {
  pageIndex: number
  pageSize: number
  pageCount: number
  onPageChange: (page: number) => void
  className?: string
}

export function TablePagination({
  pageIndex,
  // pageSize,
  pageCount,
  onPageChange,
  className
}: TablePaginationProps) {
  return (
    <div 
      className={cn(
        "flex items-center justify-between px-2",
        className
      )}
    >
      <div className="text-sm text-muted-foreground">
        Page {pageIndex + 1} of {pageCount}
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(0)}
          disabled={pageIndex === 0}
          className="h-8 w-8"
        >
          <IconChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={pageIndex === 0}
          className="h-8 w-8"
        >
          <IconChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(pageIndex + 1)}
          disabled={pageIndex === pageCount - 1}
          className="h-8 w-8"
        >
          <IconChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(pageCount - 1)}
          disabled={pageIndex === pageCount - 1}
          className="h-8 w-8"
        >
          <IconChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
} 