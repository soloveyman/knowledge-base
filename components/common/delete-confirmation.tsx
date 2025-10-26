"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Trash2 } from "lucide-react"

interface DeleteConfirmationProps {
  onConfirm: () => void
  onCancel?: () => void
  title?: string
  description?: string
  itemName?: string
  trigger?: React.ReactNode
  isLoading?: boolean
  variant?: "default" | "destructive"
}

export function DeleteConfirmation({
  onConfirm,
  onCancel,
  title = "Delete Item",
  description = "Are you sure you want to delete this item? This action cannot be undone.",
  itemName,
  trigger,
  isLoading = false,
  variant = "destructive"
}: DeleteConfirmationProps) {
  const [open, setOpen] = useState(false)

  const handleConfirm = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    onConfirm()
    setOpen(false)
  }

  const handleCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    onCancel?.()
    setOpen(false)
  }

  const displayTitle = itemName ? `Delete ${itemName}` : title
  const displayDescription = itemName 
    ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
    : description

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Dialog is closing - ensure any parent click handlers don't fire
      // This is handled by the Dialog component itself, but we add this for safety
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader className="gap-4 text-left">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <DialogTitle className="text-left wrap-break-word max-w-full">{displayTitle}</DialogTitle>
              <DialogDescription className="text-left mt-2 wrap-break-word max-w-full">
                {displayDescription}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-3 sm:gap-3">
          <Button
            variant="outline"
            onClick={(e) => handleCancel(e)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={variant}
            onClick={(e) => handleConfirm(e)}
            disabled={isLoading}
            className="min-w-[80px]"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Deleting...
              </div>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  )
}
