"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useLayoutEffect, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DocumentTypeBadge } from "@/lib/badges"
import { useNavigateBack, getRedirectUrl } from "@/lib/redirect-utils"
import { DocumentRenderer } from "@/components/common/document-renderer"
import { useTranslation } from "@/lib/translation-context"

interface UserWithRole {
  name?: string | null
  email?: string | null
  role?: string
}

interface Assignment {
  id: string
  name: string
  description: string
  document: {
    id: number
    name: string
    type: string
    uploadedAt: string
  }
  test: {
    id: string
    title: string
    questionCount: number
  }
  assignedUsers: Array<{
    id: number
    name: string
    email: string
    role: string
    department: string
  }>
  dueDate: string
  createdAt: string
  createdBy: string
  status: string
}
import { 
  FileText, 
  X,
  ArrowLeft,
  TestTube,
  CheckCircle
} from "lucide-react"
import { useParams } from "next/navigation"

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const cleanDocumentContent = (content: string) => {
  // Remove formatting tags like [CENTER], [/CENTER], etc.
  return content
    .replace(/\[CENTER\]/gi, '')
    .replace(/\[\/CENTER\]/gi, '')
    .replace(/\[BOLD\]/gi, '')
    .replace(/\[\/BOLD\]/gi, '')
    .replace(/\[ITALIC\]/gi, '')
    .replace(/\[\/ITALIC\]/gi, '')
    .replace(/\[.*?\]/gi, '') // Remove any other tags like [SIZE], [COLOR], etc.
}

interface DocumentData {
  id: string
  name: string
  type: string
  uploadedAt: string
  uploadedBy: string
  size: string
  content: string
  tables?: Array<{
    title: string
    headers: string[]
    rows: string[][]
  }>
}

interface AssignmentData {
  id: string
  name: string
  description: string
  document: DocumentData
  test: {
    id: string
    title: string
    questionCount: number
  } | null
  dueDate: string
  status: string
}

export default function DocumentReaderPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const documentId = params.documentId as string
  const navigateBack = useNavigateBack()
  const { t } = useTranslation()

  const [documentData, setDocumentData] = useState<DocumentData | null>(null)
  const [assignmentData, setAssignmentData] = useState<AssignmentData | null>(null)
  const [loading, setLoading] = useState(true)

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Load assignment data from API
    const loadAssignmentData = async () => {
      try {
        // Fetch document directly by ID (more efficient than fetching all documents)
        // Try both documentId and moduleId formats since documentId might be either
        const docResponse = await fetch(`/api/documents/${documentId}`, { cache: 'no-store' })
        const docResult = await docResponse.json()
        
        let document = null
        if (docResult.success && docResult.data.document) {
          document = docResult.data.document
        } else {
          // Fallback: try fetching all documents if direct fetch fails
          const allDocsResponse = await fetch('/api/documents', { cache: 'no-store' })
          const allDocsResult = await allDocsResponse.json()
          
          if (allDocsResult.success && allDocsResult.data.documents) {
            interface ApiDocument {
              id: string | number
              originalFileName?: string
              title?: string
              fileType?: string
              createdAt?: string
              uploadedBy?: string
              fileSize?: number
              moduleId?: string | null
              parsedContent?: {
                sections?: Array<{ content: string }>
                tables?: Array<{
                  title: string
                  headers: string[]
                  rows: string[][]
                }>
              }
            }
            
            document = (allDocsResult.data.documents as ApiDocument[]).find((doc: ApiDocument) => 
              String(doc.id) === String(documentId) || String(doc.moduleId) === String(documentId)
            )
          }
        }
        
        if (!document) {
          setLoading(false)
          return
        }
        
        console.log('Document parsedContent:', document.parsedContent)
        console.log('Document sections:', document.parsedContent?.sections)
        console.log('Document tables:', document.parsedContent?.tables)
        
        let content = ''
        // Track position mapping from original text (without headings) to combined content (with headings)
        let positionMap: Array<{ originalStart: number; originalEnd: number; combinedStart: number; combinedEnd: number }> = []
        
        // Handle sections (for docx files) - include titles in content
        if (Array.isArray(document.parsedContent?.sections) && document.parsedContent!.sections.length > 0) {
          let originalTextPos = 0 // Position in original text (without headings)
          let combinedPos = 0 // Position in combined content (with headings)
          
          content = document.parsedContent!.sections
            .map((s: { title?: string; level?: number; content: string }, idx: number) => {
              const titleText = s.title?.trim() || ''
              const contentText = s.content?.trim() || ''
              
              // Track original text position (without headings)
              const sectionOriginalStart = originalTextPos
              const sectionOriginalEnd = originalTextPos + contentText.length
              
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
              
              // Update position mapping
              if (contentText.length > 0) {
                const sectionCombinedStart = combinedPos
                const sectionCombinedEnd = combinedPos + result.length
                
                positionMap.push({
                  originalStart: sectionOriginalStart,
                  originalEnd: sectionOriginalEnd,
                  combinedStart: sectionCombinedStart,
                  combinedEnd: sectionCombinedEnd
                })
              }
              
              originalTextPos = sectionOriginalEnd
              combinedPos += result.length + 2 // +2 for \n\n separator
              
              return result
            })
            .filter((c: string) => c && c.length > 0) // Filter out empty sections
            .join('\n\n')
          // Trim leading/trailing newlines but preserve internal structure
          content = content.replace(/^\n+/, '').replace(/\n+$/, '')
        }
        
        // Extract tables separately (for xlsx files)
        const tables = document.parsedContent?.tables || []
        
        // Extract images from parsedContent and embed them in content
        // NOTE: Images may already be in sections from save process, so check first
        const images = document.parsedContent?.images || []
        
        // Check if images are already in content (from save process)
        const contentHasImages = content.includes('![') || content.includes('<img')
        
        if (images.length > 0 && !contentHasImages) {
          // Sort images by position (if available) to insert them in order
          const sortedImages = [...images].sort((a, b) => {
            const posA = a.position ?? Infinity
            const posB = b.position ?? Infinity
            return posA - posB
          })
          
          // Load image data (for large images stored in database)
          const { getImageDataUrl } = await import('@/lib/image-loader')
          const imageDataPromises = sortedImages.map(async (img: any) => {
            // Early validation: skip images that clearly won't work
            if ((img.filename?.includes('word/media/') || img.filename?.includes('xl/media/')) && !img.url && !img.imageId) {
              return null
            }
            
            try {
              const dataUrl = await getImageDataUrl(img)
              
              // Validate the dataUrl before returning
              if (dataUrl.startsWith('data:') && (dataUrl.endsWith(',') || dataUrl.split(',').length === 1 || dataUrl.split(',')[1]?.trim().length === 0)) {
                return null
              }
              
              if (!dataUrl.startsWith('data:') && !dataUrl.startsWith('http://') && !dataUrl.startsWith('https://') && !dataUrl.startsWith('/')) {
                if (dataUrl.includes('/') || dataUrl.includes('\\')) {
                  return null
                }
              }
              
              return { ...img, dataUrl }
            } catch (error) {
              return null
            }
          })
          const imagesWithData = (await Promise.all(imageDataPromises)).filter((img): img is { filename: string; dataUrl: string; type: string; position?: number } => img !== null && img.dataUrl && img.dataUrl.trim().length > 0)
          
          // Map image positions from original text to combined content
          const mapPositionToCombined = (originalPos: number): number | null => {
            // Find which section this position belongs to
            for (const mapping of positionMap) {
              if (originalPos >= mapping.originalStart && originalPos <= mapping.originalEnd) {
                // Calculate relative position within section
                const relativePos = originalPos - mapping.originalStart
                // Map to combined position
                const combinedPos = mapping.combinedStart + relativePos
                return Math.min(combinedPos, mapping.combinedEnd)
              }
            }
            // If position is beyond all sections, return end of content
            if (originalPos > (positionMap[positionMap.length - 1]?.originalEnd || 0)) {
              return content.length
            }
            return null
          }
          
          // Find best insertion point (after sentence/paragraph boundary)
          const findInsertionPoint = (targetPos: number): number => {
            if (targetPos >= content.length) return content.length
            
            // Try to find sentence boundary (., !, ? followed by space)
            const afterPos = content.substring(targetPos, Math.min(targetPos + 200, content.length))
            const sentenceEnd = afterPos.search(/[.!?]\s+/)
            if (sentenceEnd !== -1) {
              return targetPos + sentenceEnd + 2 // +2 for ". "
            }
            
            // Try to find paragraph boundary (double newline)
            const paraEnd = afterPos.search(/\n\n/)
            if (paraEnd !== -1) {
              return targetPos + paraEnd + 2
            }
            
            // Try to find word boundary (space)
            const wordEnd = afterPos.search(/\s/)
            if (wordEnd !== -1) {
              return targetPos + wordEnd + 1
            }
            
            // Fallback to exact position
            return targetPos
          }
          
          // Separate images with valid positions from those without
          const imagesWithPositions = imagesWithData
            .map(img => {
              if (img.position === undefined || img.position < 0) return null
              const combinedPosition = mapPositionToCombined(img.position)
              if (combinedPosition !== null && combinedPosition > 0) {
                return { ...img, mappedPosition: combinedPosition }
              }
              return null
            })
            .filter((img): img is { filename: string; dataUrl: string; type: string; position?: number; mappedPosition: number } => img !== null)
          const imagesWithoutPositions = imagesWithData.filter(img => 
            !(img.position !== undefined && img.position > 0)
          )
          
          let contentWithImages = content
          let offset = 0
          
          // First, insert images with valid positions (sorted by mapped position to maintain order)
          const sortedImagesWithPositions = [...imagesWithPositions].sort((a, b) => a.mappedPosition - b.mappedPosition)
          sortedImagesWithPositions.forEach((img) => {
            const imageMarkdown = `\n\n![${img.filename}](${img.dataUrl})\n\n`
            const bestInsertPos = findInsertionPoint(img.mappedPosition + offset)
            const insertPos = Math.min(bestInsertPos, contentWithImages.length)
            
            if (insertPos <= contentWithImages.length) {
              contentWithImages = 
                contentWithImages.slice(0, insertPos) + 
                imageMarkdown + 
                contentWithImages.slice(insertPos)
              offset += imageMarkdown.length
            } else {
              // Position is out of bounds, append at the end
              contentWithImages += imageMarkdown
            }
          })
          
          // Then, append images without positions at the end
          if (imagesWithoutPositions.length > 0) {
            imagesWithoutPositions.forEach((img: { filename: string; dataUrl: string; type: string; position?: number }) => {
              const imageMarkdown = `\n\n![${img.filename}](${img.dataUrl})\n\n`
              contentWithImages += imageMarkdown
            })
          }
          
          content = contentWithImages
        }
        
        // Fallback if no content
        if (!content && tables.length === 0) {
          content = 'Document content will be displayed here...'
        }
          
        // Clean artifacts immediately after extraction (but preserve legitimate lists)
        content = content
          .replace(/;\s*1\./g, '')  // Remove "; 1." (artifact)
          .replace(/\.\s*1\./g, '.')  // Remove ". 1." -> "." (artifact at end of sentence)
          .replace(/\s+1\.\s*$/gm, '')  // Remove " 1." at END of lines only
          // Note: Do NOT remove "1." at START of lines (legitimate lists)
        
        console.log('Final content for display:', content.substring(0, 200))
        console.log('Found tables:', tables.length)
        
        const newDocumentData = {
          id: String(document.id),
          name: document.originalFileName || document.title || 'Untitled',
          type: document.fileType?.toUpperCase() || 'DOCX',
          uploadedAt: document.createdAt || new Date().toISOString(),
          uploadedBy: document.uploadedBy || 'Unknown',
          size: document.fileSize ? formatFileSize(document.fileSize) : 'Unknown',
          content: content,
          tables: tables.length > 0 ? tables : undefined
        }
          
          setDocumentData(newDocumentData)
            
          // Find the assignment that has this document
          const response = await fetch(`/api/assignments`, { cache: 'no-store' })
          const result = await response.json()
          
          if (result.success) {
            interface AssignmentWithModule {
              id: string
              moduleId?: string | null
              testId?: string | null
              title?: string
              description?: string
              dueDate?: string
              status?: string
            }
            
            // Find assignment that has this moduleId
            const assignment = (result.data.assignments as AssignmentWithModule[]).find((a: AssignmentWithModule) => a.moduleId === document.moduleId)
            
            if (assignment) {
              // Fetch test data if testId exists (non-blocking, will update when ready)
              let testData = null
              if (assignment.testId) {
                // Fetch test in background (non-blocking)
                fetch(`/api/tests/${assignment.testId}`, { cache: 'no-store' })
                  .then(testResponse => testResponse.json())
                  .then(testResult => {
                    if (testResult.success && testResult.data.test) {
                      const loadedTestData = {
                        id: assignment.testId!,
                        title: testResult.data.test.title,
                        questionCount: testResult.data.test.questionIds?.length || 0
                      }
                      setAssignmentData(prev => prev ? {
                        ...prev,
                        test: loadedTestData
                      } : null)
                    }
                  })
                  .catch(error => {
                    console.error('Error loading test:', error)
                  })
              }
              
              setAssignmentData({
                id: assignment.id,
                name: assignment.title || 'Assignment',
                description: assignment.description || '',
                document: newDocumentData,
                test: testData,
                dueDate: assignment.dueDate || '',
                status: assignment.status || 'in_progress'
              })
            } else {
              setAssignmentData({
                id: String(document.id),
                name: document.title || 'Document',
                description: '',
                document: newDocumentData,
                test: null,
                dueDate: '',
                status: 'completed'
              })
            }
          }
      } catch (error) {
        console.error('Error loading assignment:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAssignmentData()
  }, [session, status, router, documentId])


  const handleTakeTest = () => {
    if (assignmentData?.test) {
      // Ensure test id is a string
      const testId = String(assignmentData.test.id)
      router.push(`/test/${testId}`)
    }
  }

  const handleCompleteAssignment = async () => {
    if (!assignmentData?.id) return
    
    // Only complete if there's no test (assignments with tests are completed via test attempts)
    if (!assignmentData.test) {
      try {
        const response = await fetch(`/api/assignments/${assignmentData.id}/complete`, {
          method: 'POST'
        })
        const result = await response.json()
        
        if (result.success) {
          setAssignmentData(prev => prev ? { ...prev, status: 'completed' } : null)
        }
      } catch (error) {
        console.error('Error completing assignment:', error)
      }
    }
  }

  const handleBack = () => {
    // Determine user role from session or default to employee
    const userRole = (session?.user as UserWithRole)?.role || 'employee'
    // Ensure userRole is a string and valid
    const validRole = typeof userRole === 'string' ? userRole : 'employee'
    // Handle super-admin - redirect to owner page
    if (validRole === 'super-admin') {
      router.push('/owner?tab=assignments')
    } else {
      navigateBack(validRole as 'employee' | 'manager' | 'owner', 'assignments')
    }
  }


  // Don't block UI while session loads - show page immediately
  if (status === "loading") {
    // Show page but with disabled state - don't block with spinner
  }

  if (!session) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background animate-in fade-in-0 duration-200">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading document...</p>
        </div>
      </div>
    )
  }

  if (!documentData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <FileText className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 sm:mb-6 text-muted-foreground" />
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground dark:text-white mb-3 sm:mb-4 leading-tight">
            {t('documentNotFoundTitle')}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 leading-relaxed max-w-md mx-auto">
            {t('documentNotFound')}
          </p>
          <Button onClick={handleBack} size="lg">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToAssignments')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16 sm:h-18">
            <div className="flex items-center min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground dark:text-white truncate leading-tight mb-0.5">
                  {assignmentData?.name || documentData.name}
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground truncate leading-relaxed">
                  {documentData.name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={handleBack}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>


      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-4 sm:pb-6 md:py-8 lg:py-10">
        <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
          {/* Document Content */}
          <Card className="overflow-x-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl font-bold leading-tight">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
                    <span className="break-words">{documentData.name}</span>
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 lg:p-8 overflow-x-hidden">
              {documentData.type === 'PDF' ? (
                <div className="w-full h-[500px] sm:h-[600px] lg:h-[calc(100vh-12rem)] border border-border rounded-3xl overflow-hidden">
                  <iframe 
                    src={`/api/documents/${encodeURIComponent(documentData.name)}`}
                    className="w-full h-full"
                    title={documentData.name}
                  />
                </div>
              ) : (
                <DocumentRenderer 
                  content={documentData.content} 
                  tables={documentData.tables}
                />
              )}
            </CardContent>
          </Card>

          {/* Card Section */}
          {(assignmentData?.test || assignmentData) && (
            <div>
              <div className="w-full">
                {/* Test Section */}
                {assignmentData?.test ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 leading-tight">
                        <span className="text-2xl">📝</span>
                        <span>{t('testAvailable')}</span>
                      </CardTitle>
                      <CardDescription className="text-sm sm:text-base leading-relaxed mt-2">
                        {t('completeTheTestAfterReadingTheDocument')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-sm sm:text-base text-muted-foreground space-y-2.5 leading-relaxed">
                        <p className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                          <strong className="font-semibold text-foreground">{t('testLabel')}:</strong>
                          <span>{assignmentData?.test?.title || t('test')}</span>
                        </p>
                        <p className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                          <strong className="font-semibold text-foreground">{t('questionsLabel')}:</strong>
                          <span>{assignmentData?.test?.questionCount || 0}</span>
                        </p>
                        <p className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                          <strong className="font-semibold text-foreground">{t('estimatedTime')}:</strong>
                          <span>15 {t('minutes')}</span>
                        </p>
                      </div>
                      
                      <Button 
                        onClick={handleTakeTest}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        disabled={assignmentData?.status === 'completed'}
                      >
                        <TestTube className="h-4 w-4 mr-2" />
                        {assignmentData?.status === 'completed' ? t('testCompleted') : t('takeTest')}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  /* No test - show completion button */
                  assignmentData && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 leading-tight">
                          <span className="text-2xl">📖</span>
                          <span>{t('readingAssignment')}</span>
                        </CardTitle>
                        <CardDescription className="text-sm sm:text-base leading-relaxed mt-2">
                          {assignmentData.status === 'completed' 
                            ? t('assignmentCompleted') 
                            : t('markAsCompleteAfterReading')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          onClick={handleCompleteAssignment}
                          className="w-full bg-green-600 hover:bg-green-700"
                          disabled={assignmentData.status === 'completed'}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {assignmentData.status === 'completed' 
                            ? t('completed') 
                            : t('markAsComplete')}
                        </Button>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
