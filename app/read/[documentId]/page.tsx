"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DocumentTypeBadge } from "@/lib/badges"
import { useNavigateBack, getRedirectUrl } from "@/lib/redirect-utils"
import { renderFormattedText } from "@/lib/content-renderer"
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
  BookOpen,
  TestTube,
  ArrowLeft
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

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Load assignment data from API
    const loadAssignmentData = async () => {
      try {
        // Load actual document data directly using documentId from URL
        const docResponse = await fetch('/api/documents')
        const docResult = await docResponse.json()
        
        let documentData = null
        if (!docResult.success) {
          setLoading(false)
          return
        }
        
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
        
        // Find document by the documentId in the URL
        const document = (docResult.data.documents as ApiDocument[]).find((doc: ApiDocument) => String(doc.id) === String(documentId))
        if (!document) {
          setLoading(false)
          return
        }
        
        console.log('Document parsedContent:', document.parsedContent)
        console.log('Document sections:', document.parsedContent?.sections)
        console.log('Document tables:', document.parsedContent?.tables)
        
        let content = ''
        
        // Handle sections (for docx files)
        if (Array.isArray(document.parsedContent?.sections) && document.parsedContent!.sections.length > 0) {
          content = document.parsedContent!.sections.map(s => s.content).join('\n')
        }
        
        // Handle tables (for xlsx files)
        if (Array.isArray(document.parsedContent?.tables) && document.parsedContent!.tables.length > 0) {
          const tablesContent = document.parsedContent.tables.map(table => {
            let tableText = `<div class="mb-6"><h3 class="text-xl font-semibold mb-3">${table.title}</h3><div class="overflow-x-auto"><table class="min-w-full border-collapse"><tbody>`
            
            // Add headers if they exist
            if (table.headers && table.headers.length > 0 && table.headers.some(h => h)) {
              tableText += '<tr class="bg-muted border-b border-border">'
              table.headers.forEach(header => {
                tableText += `<th class="px-4 py-2 text-left text-sm font-semibold">${header || ''}</th>`
              })
              tableText += '</tr>'
            }
            
            // Add rows
            table.rows.forEach((row, rowIndex) => {
              if (row && row.some(cell => cell)) {
                tableText += `<tr class="border-b border-border">`
                row.forEach(cell => {
                  tableText += `<td class="px-4 py-2">${cell || ''}</td>`
                })
                tableText += '</tr>'
              }
            })
            
            tableText += '</tbody></table></div></div>'
            return tableText
          }).join('\n')
          
          content += tablesContent
        }
        
        // Fallback if no content
        if (!content) {
          content = 'Document content will be displayed here...'
        }
          
          // Clean artifacts immediately after extraction (but preserve legitimate lists)
          content = content
            .replace(/;\s*1\./g, '')  // Remove "; 1." (artifact)
            .replace(/\.\s*1\./g, '.')  // Remove ". 1." -> "." (artifact at end of sentence)
            .replace(/\s+1\.\s*$/gm, '')  // Remove " 1." at END of lines only
            // Note: Do NOT remove "1." at START of lines (legitimate lists)
          
          console.log('Final content for display:', content.substring(0, 200))
          
          documentData = {
            id: String(document.id),
            name: document.originalFileName || document.title || 'Untitled',
            type: document.fileType?.toUpperCase() || 'DOCX',
            uploadedAt: document.createdAt || new Date().toISOString(),
            uploadedBy: document.uploadedBy || 'Unknown',
            size: document.fileSize ? formatFileSize(document.fileSize) : 'Unknown',
            content: content
          }
          
          setDocumentData(documentData)
            
          // Find the assignment that has this document
          const response = await fetch(`/api/assignments`)
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
              // Fetch test data if testId exists
              let testData = null
              if (assignment.testId) {
                try {
                  const testResponse = await fetch(`/api/tests/${assignment.testId}`)
                  const testResult = await testResponse.json()
                  if (testResult.success && testResult.data.test) {
                    testData = {
                      id: assignment.testId,
                      title: testResult.data.test.title,
                      questionCount: testResult.data.test.questionIds?.length || 0
                    }
                  }
                } catch (error) {
                  console.error('Error loading test:', error)
                }
              }
              
              setAssignmentData({
                id: assignment.id,
                name: assignment.title || 'Assignment',
                description: assignment.description || '',
                document: documentData,
                test: testData,
                dueDate: assignment.dueDate || '',
                status: assignment.status || 'in_progress'
              })
            } else {
              setAssignmentData({
                id: String(document.id),
                name: document.title || 'Document',
                description: '',
                document: documentData,
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

  const handleBack = () => {
    // Determine user role from session or default to employee
    const userRole = (session?.user as UserWithRole)?.role || 'employee'
    // Ensure userRole is a string and valid
    const validRole = typeof userRole === 'string' ? userRole : 'employee'
    navigateBack(validRole as 'employee' | 'manager' | 'owner', 'assignments')
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

  if (!documentData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground dark:text-white mb-2">Document Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested document could not be found.</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assignments
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-sm shadow-sm border-b border-border sticky sm:static top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground dark:text-white truncate">
                  {assignmentData?.name || documentData.name}
                </h1>
                <p className="text-sm text-muted-foreground truncate">
                  {documentData.name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>


      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {/* Document Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {documentData.name}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <div className="prose max-w-none">
                  {documentData.type === 'PDF' ? (
                    <div className="w-full h-[500px] sm:h-[600px] lg:h-screen border border-border rounded-lg overflow-hidden">
                      <iframe 
                        src={`/api/documents/${encodeURIComponent(documentData.name)}`}
                        className="w-full h-full"
                        title={documentData.name}
                      />
                    </div>
                  ) : (
                    <div 
                      className="document-content prose max-w-none overflow-x-auto"
                      dangerouslySetInnerHTML={{ 
                        __html: documentData.content.includes('<table') 
                          ? documentData.content // HTML already rendered (xlsx)
                          : renderFormattedText(documentData.content) // Process text (docx)
                      }}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Test Section */}
              {assignmentData?.test && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TestTube className="h-5 w-5" />
                      {t('testAvailable')}
                    </CardTitle>
                    <CardDescription>
                      {t('completeTheTestAfterReadingTheDocument')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      <p><strong>{t('testLabel')}:</strong> {assignmentData?.test?.title || t('test')}</p>
                      <p><strong>{t('questionsLabel')}:</strong> {assignmentData?.test?.questionCount || 0}</p>
                      <p><strong>{t('estimatedTime')}:</strong> 15 {t('minutes')}</p>
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
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
