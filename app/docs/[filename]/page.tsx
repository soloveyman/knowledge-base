"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DocumentTypeBadge } from "@/lib/badges"
import { useNavigateBack } from "@/lib/redirect-utils"
import { processTextWithEnhancedFormatting } from '@/lib/text-formatting'
import { renderFormattedText } from '@/lib/content-renderer'

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
  tables?: Array<{
    title: string
    headers: string[]
    rows: string[][]
  }>
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
  const navigateBack = useNavigateBack()

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
        console.log('Document ID:', document.id)

        if (document) {
          console.log('Document parsedContent:', document.parsedContent)
          console.log('Document sections:', document.parsedContent?.sections)
          console.log('Document tables:', document.parsedContent?.tables)
          
          // Extract content from sections
          let content = ''
          if (document.parsedContent?.sections?.length > 0) {
            content = document.parsedContent.sections.map(s => s.content).join('\n')
          }
          
          // Extract tables from parsedContent  
          const tables = document.parsedContent?.tables || []
          
          // If no sections but we have tables, show a message
          if (!content && tables.length > 0) {
            content = 'Document contains tables below.'
          } else if (!content) {
            content = 'Document content will be displayed here...'
          }
          
          // Debug: Check for newlines in content
          console.log('Content has newlines:', content.includes('\n'))
          console.log('Content has double newlines:', content.includes('\n\n'))
          console.log('First 500 chars of raw content:', content.substring(0, 500))
          console.log('Parser version:', document.parsedContent?.metadata?.parserVersion)
          console.log('Total newline count:', (content.match(/\n/g) || []).length)
          console.log('Content sample with \\n visible:', content.substring(0, 200).replace(/\n/g, '\\n'))
          
          // Clean artifacts immediately after extraction (but preserve legitimate lists)
          content = content
            .replace(/;\s*1\./g, '')  // Remove "; 1." (artifact)
            .replace(/\.\s*1\./g, '.')  // Remove ". 1." -> "." (artifact at end of sentence)
            .replace(/\s+1\.\s*$/gm, '')  // Remove " 1." at END of lines only
            // Note: Do NOT remove "1." at START of lines (legitimate lists)
          
          console.log('Final content for display:', content.substring(0, 200))
          console.log('Found tables:', tables.length)
          
          setDocumentData({
            id: document.id,
            name: document.originalFileName || document.title,
            type: document.fileType?.toUpperCase() || 'DOCX',
            uploadedAt: document.createdAt,
            uploadedBy: document.uploadedBy || 'Unknown',
            size: document.fileSize ? formatFileSize(document.fileSize) : 'Unknown',
            content: content,
            tables: tables
          })
        } else {
          console.log('Document not found, redirecting back')
          // Document doesn't exist, redirect back to previous tab
          const userRole = (session?.user as UserWithRole)?.role || 'manager'
          navigateBack(userRole as 'employee' | 'manager' | 'owner', 'docs')
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

  // Helper function to escape HTML characters
  const escapeHTML = (text: string) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  // Helper function to render tables as HTML
  const renderTablesAsHTML = (tables?: Array<{title: string; headers: string[]; rows: string[][]}>): string => {
    if (!tables || tables.length === 0) {
      console.log('No tables to render')
      return ''
    }
    
    console.log('Rendering tables:', tables.length)
    tables.forEach((table, index) => {
      console.log(`Table ${index}:`, table.title, 'Headers:', table.headers.length, 'Rows:', table.rows.length)
    })
    
    return tables.map(table => {
      const escapedTitle = escapeHTML(table.title)
      
      // Filter out empty rows (rows where all cells are empty or whitespace)
      const nonEmptyRows = table.rows.filter(row => {
        // Check if row has at least one non-empty cell
        return row && row.length > 0 && row.some(cell => 
          cell !== null && cell !== undefined && String(cell).trim().length > 0
        )
      })
      
      // Skip entire table if no rows have content
      if (nonEmptyRows.length === 0) {
        console.log(`Skipping empty table: ${table.title}`)
        return ''
      }
      
      console.log(`Rendering table: ${table.title} with ${nonEmptyRows.length} non-empty rows`)
      
      // Only render headers if they exist and are not empty
      const hasHeaders = table.headers && table.headers.length > 0 && table.headers.some(h => h.trim())
      const headersHTML = hasHeaders ? table.headers.map((header, idx) => {
        const escapedHeader = escapeHTML(header)
        // Use fit-content for natural width, with reasonable constraints
        return `<th class="px-2 md:px-4 py-2 text-left border-b border-border bg-muted/50 font-semibold text-xs md:text-sm" style="min-width: fit-content; white-space: normal;">${escapedHeader}</th>`
      }).join('') : ''
      
      const rowsHTML = nonEmptyRows.map(row => {
        const cellsHTML = row.map((cell, idx) => {
          const escapedCell = escapeHTML(String(cell))
          return `<td class="px-2 md:px-4 py-2 border-b border-border text-xs md:text-sm" style="white-space: normal;">${escapedCell}</td>`
        }).join('')
        return `<tr class="hover:bg-muted/20">${cellsHTML}</tr>`
      }).join('')
      
      // Render table with or without headers based on detection
      const tableHTML = hasHeaders 
        ? `
          <table class="w-full border-collapse" style="table-layout: auto; width: 100%; border: none;">
            <thead>
              <tr>${headersHTML}</tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
        `
        : `
          <table class="w-full border-collapse" style="table-layout: auto; width: 100%; border: none;">
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
        `
      
      return `
        <div class="my-8 w-full overflow-x-auto">
          <h3 class="text-base md:text-xl font-bold mb-4 text-foreground">${escapedTitle}</h3>
          <div class="w-full">
            ${tableHTML}
          </div>
        </div>
      `
    }).join('')
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
      <header className="bg-card/95 backdrop-blur-sm shadow-sm border-b border-border sticky top-0 z-10 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
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
        <div className="min-h-screen w-full">
          {documentData?.type === 'PDF' ? (
            <div className="w-full h-[500px] sm:h-[600px] md:h-[700px] lg:h-screen border border-border rounded-lg overflow-hidden">
              <iframe 
                src={`/api/documents/${encodeURIComponent(filename)}`}
                className="w-full h-full"
                title={documentData?.name}
              />
            </div>
          ) : (
            <div className="document-content" style={{ maxWidth: '100%', width: '100%' }}>
              {documentData?.content ? (
                <>
                  <div dangerouslySetInnerHTML={{ 
                      __html: (() => {
                        const formatted = renderFormattedText(documentData.content)
                        console.log('Processing content with length:', documentData.content.length)
                        console.log('Formatted HTML length:', formatted.length)
                        console.log('First 200 chars of formatted HTML:', formatted.substring(0, 200))
                        return formatted
                      })()
                    }} 
                  />
                  {/* Render tables after content */}
                  {documentData?.tables && documentData.tables.length > 0 && (
                    <div dangerouslySetInnerHTML={{ 
                        __html: renderTablesAsHTML(documentData.tables)
                      }} 
                    />
                  )}
                </>
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