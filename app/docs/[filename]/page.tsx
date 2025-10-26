"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DocumentTypeBadge } from "@/lib/badges"
import { navigateBack } from "@/lib/redirect-utils"
import { processTextWithEnhancedFormatting } from '@/lib/text-formatting'

interface UserWithRole {
  name?: string | null
  email?: string | null
  role?: string
}

interface Document {
  id: number
  name: string
  type: string
  content: string
  uploadedAt: string
  uploadedBy: string
  size: string
}
import { 
  FileText, 
  X
} from "lucide-react"
import { useParams } from "next/navigation"

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function DocumentViewer() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const filename = params.filename as string

  const [documentData, setDocumentData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Load document data from database
    loadDocumentData()
  }, [session, status, router, filename])

  const loadDocumentData = async () => {
    try {
      setLoading(true)
      
      console.log('Loading document data for filename:', filename)
      
      // Fetch all documents from the database
      const response = await fetch('/api/documents')
      const result = await response.json()
      
      console.log('Documents API response:', result)
      
      if (result.success) {
        // Find the document by filename
        const document = result.data.documents.find((doc: any) => 
          doc.originalFileName === decodeURIComponent(filename) || doc.title === decodeURIComponent(filename)
        )

        console.log('Found document:', document)

        if (document) {
          console.log('Document parsedContent:', document.parsedContent)
          console.log('Document sections:', document.parsedContent?.sections)
          
          const content = document.parsedContent ? 
            (document.parsedContent.sections?.map(s => s.content).join('\n') || 'Document content will be displayed here...') :
            'Document content will be displayed here...'
          
          console.log('Final content for display:', content.substring(0, 200))
          
          setDocumentData({
            id: document.id,
            name: document.originalFileName || document.title,
            type: document.fileType?.toUpperCase() || 'DOCX',
            uploadedAt: document.createdAt,
            uploadedBy: document.uploadedBy || 'Unknown',
            size: document.fileSize ? formatFileSize(document.fileSize) : 'Unknown',
            content: content
          })
        } else {
          console.log('Document not found, redirecting back')
          // Document doesn't exist, redirect back to previous tab
          const userRole = (session?.user as UserWithRole)?.role || 'manager'
          navigateBack(router, userRole as 'employee' | 'manager' | 'owner', 'docs')
          return
        }
      } else {
        console.error('Failed to load documents:', result.message)
        // Redirect back on error
        const userRole = (session?.user as UserWithRole)?.role || 'manager'
        navigateBack(router, userRole as 'employee' | 'manager' | 'owner', 'docs')
        return
      }
    } catch (error) {
      console.error('Error loading document:', error)
      // Redirect back on error
      const userRole = (session?.user as UserWithRole)?.role || 'manager'
      navigateBack(router, userRole as 'employee' | 'manager' | 'owner', 'docs')
      return
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    // Navigate back to the previous tab
    const userRole = (session?.user as UserWithRole)?.role || 'manager'
    navigateBack(router, userRole as 'employee' | 'manager' | 'owner', 'docs')
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-foreground dark:text-white truncate">
                {documentData?.name || 'Document Viewer'}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Document Content */}
        <div className="min-h-screen">
          {documentData?.type === 'PDF' ? (
            <div className="w-full h-screen border border-border rounded-lg overflow-hidden">
              <iframe 
                src={`/api/documents/${encodeURIComponent(filename)}`}
                className="w-full h-full"
                title={documentData?.name}
              />
            </div>
          ) : (
            <div className="prose max-w-none document-content">
              {documentData?.content ? (
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: processTextWithEnhancedFormatting(documentData.content).html 
                  }} 
                />
              ) : (
                <div>
                  <h1>{documentData?.name || 'Document'}</h1>
                  <p>Document content will be displayed here...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}