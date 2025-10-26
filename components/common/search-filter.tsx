"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Search, X, Filter } from "lucide-react"
import { useState } from "react"

interface FilterOption {
  label: string
  value: string
}

interface SearchFilterProps {
  searchValue: string
  onSearchChange: (value: string) => void
  placeholder?: string
  
  filters?: Array<{
    name: string
    label: string
    options: FilterOption[]
    value: string
    onChange: (value: string) => void
  }>
  
  onReset?: () => void
  showResetButton?: boolean
}

export function SearchFilter({
  searchValue,
  onSearchChange,
  placeholder = "Search...",
  filters = [],
  onReset,
  showResetButton = false
}: SearchFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Search Input */}
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10"
        />
      </div>
      
      {/* Filters */}
      {filters.map((filter) => (
        <div key={filter.name} className="min-w-[150px]">
          <Label htmlFor={filter.name}>{filter.label}</Label>
          <Select value={filter.value} onValueChange={filter.onChange}>
            <SelectTrigger id={filter.name}>
              <SelectValue placeholder={`Select ${filter.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      
      {/* Reset Button */}
      {showResetButton && onReset && (
        <div className="flex items-end">
          <Button variant="outline" size="default" onClick={onReset}>
            <X className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      )}
    </div>
  )
}

