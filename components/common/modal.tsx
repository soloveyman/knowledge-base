"use client"

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
import { ReactNode } from "react"

interface ModalProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  onConfirm?: () => void
  onCancel?: () => void
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
}

export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default"
}: ModalProps) {
  const handleConfirm = () => {
    onConfirm?.()
    onOpenChange?.(false)
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        {children}
        {(footer || onConfirm || onCancel) && (
          <DialogFooter>
            {footer ? (
              footer
            ) : (
              <>
                {onCancel && (
                  <Button variant="outline" onClick={handleCancel}>
                    {cancelLabel}
                  </Button>
                )}
                {onConfirm && (
                  <Button variant={variant} onClick={handleConfirm}>
                    {confirmLabel}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

