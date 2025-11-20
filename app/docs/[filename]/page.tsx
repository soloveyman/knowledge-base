"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { useNavigateBack } from "@/lib/redirect-utils"
import { DocumentRenderer } from "@/components/common/document-renderer"
import { DocumentLoadingSkeleton } from "@/components/common/loading-skeleton"

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
    sections?: Array<{ 
      title?: string
      level?: number
      content: string
      order?: number
    }>
    tables?: Array<{
      title: string
      headers: string[]
      rows: string[][]
    }>
    images?: Array<{
      filename: string
      data: string
      type: string
      position?: number
    }>
    metadata?: {
      parserVersion?: string
    }
  }
}
import { X } from "lucide-react"
import { useParams } from "next/navigation"
import { toast } from "sonner"

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
  const [returnUrl, setReturnUrl] = useState<string | null>(null)

  // Preserve return URL from query params or referrer
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const returnTo = urlParams.get('returnTo')
      
      if (returnTo) {
        setReturnUrl(returnTo)
      } else {
        // Try to get from referrer
        const referrer = document.referrer
        if (referrer && (referrer.includes('/owner') || referrer.includes('/manager') || referrer.includes('/employee'))) {
          // Extract the path from referrer
          try {
            const referrerUrl = new URL(referrer)
            if (referrerUrl.pathname.startsWith('/owner') || referrerUrl.pathname.startsWith('/manager') || referrerUrl.pathname.startsWith('/employee')) {
              setReturnUrl(referrerUrl.pathname + referrerUrl.search)
            }
          } catch {
            // Invalid URL, ignore
          }
        }
      }
    }
  }, [])

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
          console.log('Document images:', document.parsedContent?.images)
          
          // Extract content from sections - include titles in content
          let content = ''
          if (document.parsedContent?.sections && document.parsedContent.sections.length > 0) {
            // Log all sections for debugging
            console.log('All sections:', document.parsedContent.sections.map((s: any, idx: number) => ({
              index: idx,
              title: s.title,
              titleLength: s.title?.length || 0,
              contentLength: s.content?.length || 0,
              contentPreview: s.content?.substring(0, 100) || ''
            })))
            
            // Merge sections with empty titles into previous section
            const mergedSections: Array<{ title?: string; level?: number; content: string }> = []
            for (let i = 0; i < document.parsedContent.sections.length; i++) {
              const s = document.parsedContent.sections[i]
              const titleText = s.title?.trim() || ''
              const contentText = s.content?.trim() || ''
              
              // If this section has an empty title (just formatting tag) and has content, merge with previous
              if (titleText && /^\[(BOLD|ITALIC|CENTER|RIGHT|JUSTIFY)\]\s*\[\/\1\]$/i.test(titleText) && contentText) {
                // Merge content with previous section
                if (mergedSections.length > 0) {
                  mergedSections[mergedSections.length - 1].content += '\n\n' + contentText
                } else {
                  // No previous section, just add the content
                  mergedSections.push({ content: contentText })
                }
              } else {
                // Normal section, add it
                mergedSections.push(s)
              }
            }
            
            content = mergedSections
              .map((s: { title?: string; level?: number; content: string }, idx: number) => {
                const titleText = s.title?.trim() || ''
                const contentText = s.content?.trim() || ''
                
                // If title is just an empty formatting tag, skip the title but keep the content
                if (titleText && /^\[(BOLD|ITALIC|CENTER|RIGHT|JUSTIFY)\]\s*\[\/\1\]$/i.test(titleText)) {
                  // Title is just an empty formatting tag, return only content
                  return contentText
                }
                
                // Include section title as markdown heading if it exists
                let sectionContent = ''
                if (titleText) {
                  const level = s.level || 2
                  const headingPrefix = '#'.repeat(Math.min(level, 6))
                  sectionContent = `${headingPrefix} ${titleText}\n\n`
                }
                // Add section content
                if (contentText) {
                  sectionContent += contentText
                }
                
                const result = sectionContent.trim()
                console.log(`Section ${idx}: title="${titleText}", contentLength=${contentText.length}, resultLength=${result.length}`)
                return result
              })
              .filter((c: string) => c && c.length > 0) // Filter out empty sections
              .join('\n\n')
            // Trim leading/trailing newlines but preserve internal structure
            content = content.replace(/^\n+/, '').replace(/\n+$/, '')
            
            console.log('Combined content length:', content.length)
            console.log('Combined content preview:', content.substring(0, 500))
          }
          
          // Extract tables from parsedContent  
          const tables = document.parsedContent?.tables || []
          
          // Extract images from parsedContent and embed them in content
          const images = document.parsedContent?.images || []
          if (images.length > 0) {
            console.log(`📸 Found ${images.length} images to display`)
            
            // Find where to insert images - look for "1. General Principles" section
            // Try multiple variations of the heading
            const generalPrinciplesPatterns = [
              /###\s+\[BOLD\]1\.\s+General\s+Principles\[\/BOLD\]/i,
              /###\s+1\.\s+General\s+Principles/i,
              /##\s+\[BOLD\]1\.\s+General\s+Principles\[\/BOLD\]/i,
              /##\s+1\.\s+General\s+Principles/i,
              /\[BOLD\]1\.\s+General\s+Principles\[\/BOLD\]/i,
              /1\.\s+General\s+Principles/i
            ]
            
            let insertPosition: number | null = null
            
            for (const pattern of generalPrinciplesPatterns) {
              const match = content.match(pattern)
              if (match && match.index !== undefined) {
                // Find the end of the "1. General Principles" section
                // Look for the next heading (## or ###) or end of content
                const startPos = match.index + match[0].length
                const afterHeading = content.substring(startPos)
                
                // Find the next heading or end of section
                const nextHeadingMatch = afterHeading.match(/^([\s\S]*?)(?=\n\n(?:###|##|\[BOLD\]|$))/)
                if (nextHeadingMatch) {
                  // Insert after the section content
                  insertPosition = startPos + nextHeadingMatch[1].length
                  console.log(`📸 Found "1. General Principles" section, will insert image at position ${insertPosition}`)
                  break
                } else {
                  // No next heading found, insert after the heading
                  insertPosition = startPos
                  console.log(`📸 Found "1. General Principles" heading, will insert image at position ${insertPosition}`)
                  break
                }
              }
            }
            
            // If we couldn't find the section, try to find it by searching for section index
            if (insertPosition === null && document.parsedContent?.sections) {
              const generalPrinciplesIndex = document.parsedContent.sections.findIndex(
                (s: { title?: string }) => s.title && /1\.\s+General\s+Principles/i.test(s.title)
              )
              
              if (generalPrinciplesIndex !== -1) {
                // Find where this section ends in the combined content
                let currentPos = 0
                for (let i = 0; i <= generalPrinciplesIndex; i++) {
                  const section = document.parsedContent.sections[i]
                  const titleText = section.title?.trim() || ''
                  const contentText = section.content?.trim() || ''
                  
                  if (i === generalPrinciplesIndex) {
                    // This is the General Principles section
                    const level = section.level || 2
                    const headingPrefix = '#'.repeat(Math.min(level, 6))
                    const sectionContent = titleText ? `${headingPrefix} ${titleText}\n\n` : ''
                    const fullSection = sectionContent + contentText
                    insertPosition = currentPos + fullSection.length
                    console.log(`📸 Found "1. General Principles" section by index, will insert image at position ${insertPosition}`)
                    break
                  } else {
                    // Calculate position for previous sections
                    const level = section.level || 2
                    const headingPrefix = '#'.repeat(Math.min(level, 6))
                    const sectionContent = titleText ? `${headingPrefix} ${titleText}\n\n` : ''
                    const fullSection = sectionContent + contentText
                    currentPos += fullSection.length + 2 // +2 for \n\n separator
                  }
                }
              }
            }
            
            // Insert images - sort by position first, then insert at their actual positions
            const sortedImages = [...images].sort((a, b) => {
              const posA = a.position ?? Infinity
              const posB = b.position ?? Infinity
              return posA - posB
            })
            
            // Load image data (for large images stored in database)
            const { getImageDataUrl } = await import('@/lib/image-loader')
            const imageDataPromises = sortedImages.map(async (img: any) => {
              // Early validation: skip images that clearly won't work
              // Skip images with word/media paths in filename and no URL/imageId (legacy/corrupted data)
              if ((img.filename?.includes('word/media/') || img.filename?.includes('xl/media/')) && !img.url && !img.imageId) {
                console.warn(`Skipping invalid image reference: ${img.filename} (no URL or imageId)`)
                return null
              }
              
              try {
                const dataUrl = await getImageDataUrl(img)
                
                // Validate the dataUrl before returning
                // Skip empty data URLs
                if (dataUrl.startsWith('data:') && (dataUrl.endsWith(',') || dataUrl.split(',').length === 1 || dataUrl.split(',')[1]?.trim().length === 0)) {
                  console.warn(`Skipping image ${img.filename}: empty data URL`)
                  return null
                }
                
                // Skip invalid relative paths
                if (!dataUrl.startsWith('data:') && !dataUrl.startsWith('http://') && !dataUrl.startsWith('https://') && !dataUrl.startsWith('/')) {
                  if (dataUrl.includes('/') || dataUrl.includes('\\')) {
                    console.warn(`Skipping image ${img.filename}: invalid relative path: ${dataUrl}`)
                    return null
                  }
                }
                
                return { ...img, dataUrl }
              } catch (error) {
                console.error(`Failed to load image: ${img.filename}`, error)
                // Skip image if it can't be loaded (don't show broken image)
                return null
              }
            })
            const imagesWithData = (await Promise.all(imageDataPromises)).filter((img): img is { filename: string; dataUrl: string; type: string; position?: number } => img !== null && img.dataUrl && img.dataUrl.trim().length > 0)
            
            // Separate images with valid positions from those without
            const imagesWithPositions = imagesWithData.filter(img => 
              img.position !== undefined && 
              img.position >= 0 && 
              img.position < content.length && 
              img.position > 0
            )
            const imagesWithoutPositions = imagesWithData.filter(img => 
              !(img.position !== undefined && 
                img.position >= 0 && 
                img.position < content.length && 
                img.position > 0)
            )
            
            let contentWithImages = content
            let offset = 0
            
            // First, insert images with valid positions
            imagesWithPositions.forEach((img: { filename: string; dataUrl: string; type: string; position?: number }) => {
              const imageMarkdown = `\n\n![${img.filename}](${img.dataUrl})\n\n`
              const insertPos = img.position! + offset
              if (insertPos < contentWithImages.length) {
                contentWithImages = 
                  contentWithImages.slice(0, insertPos) + 
                  imageMarkdown + 
                  contentWithImages.slice(insertPos)
                offset += imageMarkdown.length
                console.log(`📸 Inserted image "${img.filename}" at original position ${img.position} (adjusted: ${insertPos})`)
              } else {
                // Position is out of bounds after previous insertions, append at the end
                contentWithImages += imageMarkdown
                console.log(`📸 Appended image "${img.filename}" at the end (position ${insertPos} out of bounds)`)
              }
            })
            
            // Then, append images without positions at the end
            if (imagesWithoutPositions.length > 0) {
              imagesWithoutPositions.forEach((img: { filename: string; dataUrl: string; type: string; position?: number }) => {
                const imageMarkdown = `\n\n![${img.filename}](${img.dataUrl})\n\n`
                contentWithImages += imageMarkdown
                console.log(`📸 Appended image "${img.filename}" at the end`)
              })
            }
            
            content = contentWithImages
            
            // Debug: Check if images are in content
            const imageCount = (content.match(/!\[.*?\]\(data:image/gi) || []).length
            console.log(`📸 Images in content string: ${imageCount}`)
            console.log(`📸 Content includes image markdown: ${content.includes('![image')}`)
          }
          
          // If no sections but we have tables, leave content empty (tables will be shown)
          if (!content && tables.length === 0) {
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
          
          toast.error('Document not found', {
            description: 'The requested document could not be found',
            duration: 5000
          })
          
          // Document doesn't exist, redirect back
          if (returnUrl) {
            router.push(returnUrl)
            return
          }
          
          const userRole = (session?.user as UserWithRole)?.role || 'manager'
          
          // Handle super-admin - redirect to owner page with docs tab
          if (userRole === 'super-admin') {
            router.push('/owner?tab=docs')
            return
          }
          
          // For other roles, use navigateBack
          if (userRole === 'owner' || userRole === 'manager' || userRole === 'employee') {
            navigateBack(userRole as 'employee' | 'manager' | 'owner', 'docs')
          } else {
            router.push('/owner?tab=docs')
          }
          return
        }
      } else {
        console.error('Failed to load documents:', result.message)
        
        toast.error('Failed to load document', {
          description: result.message || 'An error occurred while loading the document',
          duration: 5000
        })
        
        // Redirect back on error
        if (returnUrl) {
          router.push(returnUrl)
          return
        }
        
        const userRole = (session?.user as UserWithRole)?.role || 'manager'
        
        // Handle super-admin - redirect to owner page with docs tab
        if (userRole === 'super-admin') {
          router.push('/owner?tab=docs')
          return
        }
        
        // For other roles, use navigateBack
        if (userRole === 'owner' || userRole === 'manager' || userRole === 'employee') {
          navigateBack(userRole as 'employee' | 'manager' | 'owner', 'docs')
        } else {
          router.push('/owner?tab=docs')
        }
        return
      }
    } catch (error) {
      console.error('Error loading document:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to load document'
      toast.error('Error loading document', {
        description: errorMessage,
        duration: 5000
      })
      
      // Redirect back on error
      if (returnUrl) {
        router.push(returnUrl)
        return
      }
      
      const userRole = (session?.user as UserWithRole)?.role || 'manager'
      
      // Handle super-admin - redirect to owner page with docs tab
      if (userRole === 'super-admin') {
        router.push('/owner?tab=docs')
        return
      }
      
      // For other roles, use navigateBack
      if (userRole === 'owner' || userRole === 'manager' || userRole === 'employee') {
        navigateBack(userRole as 'employee' | 'manager' | 'owner', 'docs')
      } else {
        router.push('/owner?tab=docs')
      }
      return
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    // Use preserved return URL if available
    if (returnUrl) {
      router.push(returnUrl)
      return
    }
    
    // Navigate back to the previous tab based on role
    const userRole = (session?.user as UserWithRole)?.role || 'manager'
    
    // Handle super-admin - redirect to owner page with docs tab (super-admin shouldn't use doc viewer from owner/manager pages)
    if (userRole === 'super-admin') {
      router.push('/owner?tab=docs')
      return
    }
    
    // For other roles, use navigateBack
    if (userRole === 'owner' || userRole === 'manager' || userRole === 'employee') {
      navigateBack(userRole as 'employee' | 'manager' | 'owner', 'docs')
    } else {
      // Fallback to owner page
      router.push('/owner?tab=docs')
    }
  }


  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <DocumentLoadingSkeleton />
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