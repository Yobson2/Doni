import React, { useState } from "react"
import { Input } from "@/components/ui/input"
// import { Button } from "@/components/ui/button"
import { IconSearch } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

interface TableToolbarProps {
  title?: string
  subtitle?: string
  onSearch?: (value: string) => void
  searchPlaceholder?: string
  className?: string
}

export function TableToolbar({
  title,
  subtitle,
  onSearch,
  searchPlaceholder = "Search...",
  className
}: TableToolbarProps) {
  const [searchValue, setSearchValue] = useState("")

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
    if (onSearch) {
      onSearch(value)
    }
  }

  return (
    <div 
      className={cn(
        "flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0",
        className
      )}
    >
      {/* Title */}
      {title && (
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}

      {/* Search and actions */}
      {onSearch && (
        <div className="flex items-center space-x-2">
          <div className="relative w-full md:w-[260px]">
            <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              className="w-full pl-8"
              value={searchValue}
              onChange={handleSearch}
            />
          </div>
        </div>
      )}
    </div>
  )
} 