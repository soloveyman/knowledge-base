"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useNavigateBack } from "@/lib/redirect-utils"
import { DocumentRenderer } from "@/components/common/document-renderer"
import { X } from "lucide-react"

interface DocumentViewerClientProps {
  document: {
    id: string | number
    name: string
    type: string
    content: string
    tables?: Array<{
      title: string
      headers: string[]
      rows: string[][]
    }>
    filenameOrId: string
  }
  userRole: string
}

export function DocumentViewerClient({ document, userRole }: DocumentViewerClientProps) {
  const router = useRouter()
  const navigateBack = useNavigateBack()

  const handleClose = () => {
    navigateBack(userRole as 'employee' | 'manager' | 'owner', 'docs')
  }

  return (
    <div className="min-h-screen bg-background" suppressHydrationWarning>
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 w-full" suppressHydrationWarning>
        <div className="max-w-[1200px] mx-auto px-2 sm:px-6" suppressHydrationWarning>
          <div className="flex justify-between items-center h-14 sm:h-16" suppressHydrationWarning>
            <div className="flex items-center min-w-0" suppressHydrationWarning>
              <h1 className="text-lg sm:text-xl font-semibold text-foreground dark:text-white truncate">
                {document.name || 'Document Viewer'}
              </h1>
            </div>
            <div className="flex items-center space-x-2" suppressHydrationWarning>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto px-2 sm:px-6 pt-6 pb-4 md:py-8" suppressHydrationWarning>
        {/* Document Content */}
        <div className="min-h-screen w-full px-4 sm:px-0 overflow-x-hidden" suppressHydrationWarning>
          {document.type === 'PDF' ? (
            <div className="w-full h-[500px] sm:h-[600px] md:h-[700px] lg:h-screen border border-border rounded-3xl overflow-hidden">
              <iframe 
                src={`/api/documents/${encodeURIComponent(document.filenameOrId)}`}
                className="w-full h-full"
                title={document.name}
              />
            </div>
          ) : (
            <div className="w-full max-w-full overflow-x-hidden" suppressHydrationWarning>
              <DocumentRenderer 
                content={document.content || ''} 
                tables={document.tables}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

