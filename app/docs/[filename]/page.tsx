"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { useNavigateBack } from "@/lib/redirect-utils"
import { DocumentRenderer } from "@/components/common/document-renderer"
import { DocumentLoadingSkeleton } from "@/components/common/loading-skeleton"
import dynamic from "next/dynamic"

// Dynamically import heavy components to reduce initial bundle
const DocumentRendererDynamic = dynamic(
  () => import("@/components/common/document-renderer").then(mod => ({ default: mod.DocumentRenderer })),
  {
    loading: () => <DocumentLoadingSkeleton />,
    ssr: false
  }
)

interface UserWithRole {
  name?: string | null
  email?: string | null
  role?: string
}

interface DocumentData {
  id: string | number
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

interface ApiDocument {
  id: string | number
  title?: string
  originalFileName?: string
  fileType?: string
  createdAt?: string
  uploadedBy?: string
  fileSize?: number
  parsedContent?: {
    sections?: Array<{ content: string }>
    tables?: Array<{
      title: string
      headers: string[]
      rows: string[][]
    }>
    metadata?: {
      parserVersion?: string
    }
  }
}
import { X } from "lucide-react"
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
  const filenameOrId = params.filename as string
  const navigateBack = useNavigateBack()

  const [documentData, setDocumentData] = useState<DocumentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Load document data from database
    loadDocumentData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router, filenameOrId])

  const loadDocumentData = async () => {
    try {
      setLoading(true)
      
      const decodedParam = decodeURIComponent(filenameOrId)
      console.log('🔍 DocumentViewer: Loading document data')
      console.log('🔍 Raw param from URL:', filenameOrId)
      console.log('🔍 Decoded param (ID or filename):', decodedParam)
      
      // Fetch all documents from the database
      const response = await fetch('/api/documents')
      const result = await response.json()
      
      console.log('Documents API response:', result)
      
      if (result.success) {
        let document: ApiDocument | undefined
        const documents = result.data.documents as ApiDocument[]
        
        // Log all document IDs for debugging
        console.log('Available document IDs:', documents.map(d => ({
          id: d.id,
          idType: typeof d.id,
          idString: String(d.id),
          originalFileName: d.originalFileName,
          title: d.title
        })))
        
        // First try to find by ID (most reliable)
        // Try both string and direct comparison since ID might be UUID
        const documentById = documents.find((doc: ApiDocument) => {
          const docIdStr = String(doc.id)
          const searchId = decodedParam.trim()
          
          // Try exact string match
          if (docIdStr === searchId) {
            console.log('Found exact match:', docIdStr, '===', searchId)
            return true
          }
          
          // Try case-insensitive match
          if (docIdStr.toLowerCase() === searchId.toLowerCase()) {
            console.log('Found case-insensitive match:', docIdStr, '===', searchId)
            return true
          }
          
          return false
        })
        
        if (documentById) {
          document = documentById
          console.log('✅ Found document by ID:', document.id)
        } else {
          // Fallback: find by filename (for backward compatibility)
          console.log('⚠️ Document not found by ID, trying filename match')
          console.log('Search param:', decodedParam)
          console.log('Available documents:', documents.map(d => ({
            id: String(d.id),
            originalFileName: d.originalFileName,
            title: d.title
          })))
          
          document = documents.find((doc: ApiDocument) => {
            const originalFileName = doc.originalFileName?.trim() || ''
            const title = doc.title?.trim() || ''
            const searchName = decodedParam.trim()
            
            // Exact matches
            if (originalFileName === searchName || title === searchName) {
              console.log('Found exact filename match')
              return true
            }
            
            // Case-insensitive matches
            if (originalFileName.toLowerCase() === searchName.toLowerCase() || 
                title.toLowerCase() === searchName.toLowerCase()) {
              console.log('Found case-insensitive filename match')
              return true
            }
            
            // Also check if either field contains the search name (for partial matches)
            if (originalFileName && originalFileName.includes(searchName)) {
              console.log('Found partial filename match in originalFileName')
              return true
            }
            if (title && title.includes(searchName)) {
              console.log('Found partial filename match in title')
              return true
            }
            
            return false
          })
          
          if (document) {
            console.log('✅ Found document by filename:', document.id)
          } else {
            console.log('❌ Document not found by ID or filename')
          }
        }

        console.log('Final document result:', document ? { id: document.id, name: document.originalFileName || document.title } : 'null')

        if (document) {
          console.log('Document ID:', document.id)
          console.log('Document parsedContent:', document.parsedContent)
          console.log('Document sections:', document.parsedContent?.sections)
          console.log('Document tables:', document.parsedContent?.tables)
          
          // Extract content from sections
          let content = ''
          if (document.parsedContent?.sections && document.parsedContent.sections.length > 0) {
            // Debug: Check section content before joining - show full content for first few sections
            console.log('Sections before joining:', document.parsedContent.sections.map((s: { title?: string; content: string }, idx: number) => {
              const numberedListsInSection = (s.content || '').match(/^\s*\d+\.\s+.+$/gm)
              return {
                index: idx,
                title: s.title?.substring(0, 50),
                contentLength: s.content?.length || 0,
                contentPreview: s.content?.substring(0, 200),
                fullContent: idx < 3 ? s.content : undefined, // Show full content for first 3 sections
                hasNumberedList: /^\s*\d+\.\s/.test(s.content || ''),
                numberedListCount: numberedListsInSection?.length || 0,
                numberedListItems: numberedListsInSection?.slice(0, 3),
                startsWithHeading: /^#+\s/.test(s.content?.trim() || '')
              }
            }))
            
            // Join sections with proper spacing, preserving list structure
            content = document.parsedContent.sections
              .map((s: { title?: string; content: string }) => {
                const sectionParts: string[] = []
                const contentTrimmed = s.content?.trim() || ''
                
                // Only add title if content doesn't already start with a heading
                // This prevents duplication when content already has markdown headings
                if (s.title && !contentTrimmed.startsWith('#')) {
                  // Convert section title to markdown heading based on level
                  const level = (s as { level?: number }).level || 2
                  const headingPrefix = '#'.repeat(Math.min(level, 6))
                  sectionParts.push(`${headingPrefix} ${s.title}`)
                }
                
                if (s.content) {
                  sectionParts.push(s.content)
                }
                
                return sectionParts.join('\n')
              })
              .filter(Boolean)
              .join('\n\n')
            
            // Debug: Check content immediately after joining
            const numberedListsAfterJoin = content.match(/^\s*\d+\.\s+.+$/gm)
            console.log('After joining sections:', {
              contentLength: content.length,
              numberedListCount: numberedListsAfterJoin?.length || 0,
              firstFewNumberedLists: numberedListsAfterJoin?.slice(0, 5),
              contentPreview: content.substring(0, 500)
            })
          }
          
          // Extract tables from parsedContent  
          const tables = document.parsedContent?.tables || []
          
          // If no sections but we have tables, leave content empty (tables will be shown)
          if (!content && tables.length === 0) {
            content = 'Document content will be displayed here...'
          }
          
          // Debug: Check for newlines and numbered lists in content
          console.log('Content has newlines:', content.includes('\n'))
          console.log('Content has double newlines:', content.includes('\n\n'))
          const numberedListMatches = content.match(/^\s*\d+\.\s+.+$/gm)
          console.log('Numbered lists found in content:', numberedListMatches?.length || 0)
          if (numberedListMatches && numberedListMatches.length > 0) {
            console.log('First few numbered lists:', numberedListMatches.slice(0, 3))
          }
          console.log('First 500 chars of raw content:', content.substring(0, 500))
          console.log('Parser version:', document.parsedContent?.metadata?.parserVersion)
          console.log('Total newline count:', (content.match(/\n/g) || []).length)
          console.log('Content sample with \\n visible:', content.substring(0, 200).replace(/\n/g, '\\n'))
          
          // Clean artifacts immediately after extraction (but preserve legitimate lists)
          // IMPORTANT: Only remove artifacts, never numbered lists at start of lines
          const beforeClean = content
          content = content
            .replace(/;\s*1\./g, '')  // Remove "; 1." (artifact)
            .replace(/\.\s*1\./g, '.')  // Remove ". 1." -> "." (artifact at end of sentence)
            .replace(/\s+1\.\s*$/gm, '')  // Remove " 1." at END of lines only
            // Note: Do NOT remove "1." at START of lines (legitimate lists)
          
          // Verify numbered lists weren't removed
          const afterClean = content.match(/^\s*\d+\.\s+.+$/gm)
          if (numberedListMatches && afterClean && numberedListMatches.length !== afterClean.length) {
            console.warn('⚠️ Warning: Some numbered lists may have been removed by cleaning!', {
              before: numberedListMatches.length,
              after: afterClean.length
            })
          }
          
          console.log('Final content for display:', content.substring(0, 200))
          console.log('Found tables:', tables.length)
          
          setDocumentData({
            id: document.id,
            name: document.originalFileName || document.title || 'Untitled Document',
            type: document.fileType?.toUpperCase() || 'DOCX',
            uploadedAt: document.createdAt || new Date().toISOString(),
            uploadedBy: document.uploadedBy || 'Unknown',
            size: document.fileSize ? formatFileSize(document.fileSize) : 'Unknown',
            content: content,
            tables: tables
          })
        } else {
          console.error('❌ Document not found!')
          console.error('Search param:', decodedParam)
          console.error('Available documents:', documents.map(d => ({
            id: String(d.id),
            originalFileName: d.originalFileName,
            title: d.title
          })))
          // Document doesn't exist, redirect back to previous tab
          const userRole = (session?.user as UserWithRole)?.role || 'manager'
          navigateBack(userRole as 'employee' | 'manager' | 'owner', 'docs')
          return
        }
      } else {
        console.error('Failed to load documents:', result.message)
        // Redirect back on error
        const userRole = (session?.user as UserWithRole)?.role || 'manager'
        navigateBack(userRole as 'employee' | 'manager' | 'owner', 'docs')
        return
      }
    } catch (error) {
      console.error('Error loading document:', error)
      // Redirect back on error
      const userRole = (session?.user as UserWithRole)?.role || 'manager'
      navigateBack(userRole as 'employee' | 'manager' | 'owner', 'docs')
      return
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    // Navigate back to the previous tab
    const userRole = (session?.user as UserWithRole)?.role || 'manager'
    navigateBack(userRole as 'employee' | 'manager' | 'owner', 'docs')
  }


  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <DocumentLoadingSkeleton />
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    )
  }
  
  if (!documentData) {
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
      <header className="bg-card border-b border-border sticky top-0 z-50 w-full">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
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
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8">
        {/* Document Content */}
        <div className="min-h-screen w-full">
          {documentData?.type === 'PDF' ? (
            <div className="w-full h-[500px] sm:h-[600px] md:h-[700px] lg:h-screen border border-border rounded-3xl overflow-hidden">
              <iframe 
                src={`/api/documents/${encodeURIComponent(filenameOrId)}`}
                className="w-full h-full"
                title={documentData?.name}
              />
            </div>
          ) : (
            <DocumentRenderer 
              content={documentData?.content || ''} 
              tables={documentData?.tables}
            />
          )}
        </div>
      </main>
    </div>
  )
}