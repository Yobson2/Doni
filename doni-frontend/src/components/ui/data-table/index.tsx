import React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { IconDotsVertical } from '@tabler/icons-react'
import { cn } from "@/lib/utils"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"

import { TablePagination } from "./table-pagination"
import { TableToolbar } from "./table-toolbar"

export interface ColumnDef<T> {
  id: string
  header: string
  accessorKey: string
  cell?: (info: T) => React.ReactNode
  enableSorting?: boolean
  meta?: {
    className?: string
  }
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  title?: string
  subtitle?: string
  searchPlaceholder?: string
  className?: string
  onSearch?: (value: string) => void
  onRowAction?: (action: string, row: T) => void
  rowActions?: { label: string, value: string }[]
  pagination?: {
    pageIndex: number
    pageSize: number
    pageCount: number
    onPageChange: (page: number) => void
  }
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  title,
  subtitle,
  searchPlaceholder = "Search...",
  className,
  onSearch,
  onRowAction,
  rowActions,
  pagination
}: DataTableProps<T>) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with title and search */}
      {(title || onSearch) && (
        <TableToolbar
          title={title}
          subtitle={subtitle}
          onSearch={onSearch ? (value) => onSearch(value) : undefined}
          searchPlaceholder={searchPlaceholder}
        />
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              {columns.map((column) => (
                <TableHead 
                  key={column.id}
                  className={cn(
                    "py-3 text-xs font-medium uppercase text-gray-600",
                    column.meta?.className
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
              {rowActions && (
                <TableHead className="w-[60px]"></TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (rowActions ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, i) => (
                <TableRow key={i} className="hover:bg-gray-50/50">
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(column.meta?.className)}
                    >
                      {column.cell
                        ? column.cell(row)
                        : row[column.accessorKey]}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell className="p-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <IconDotsVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {rowActions.map((action) => (
                            <DropdownMenuItem
                              key={action.value}
                              onClick={() => 
                                onRowAction && onRowAction(action.value, row)
                              }
                            >
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <TablePagination
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          pageCount={pagination.pageCount}
          onPageChange={pagination.onPageChange}
        />
      )}
    </div>
  )
} 