"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useNavigateBack } from "@/lib/redirect-utils"
import { DocumentRenderer } from "@/components/common/document-renderer"
import { useTranslation } from "@/lib/translation-context"
import { useSession } from "next-auth/react"
import { 
  FileText, 
  X,
  ArrowLeft,
  TestTube,
  CheckCircle
} from "lucide-react"

interface DocumentReaderClientProps {
  document: {
    id: string
    name: string
    type: string
    content: string
    tables?: Array<{
      title: string
      headers: string[]
      rows: string[][]
    }>
  }
  assignment: {
    id: string
    name: string
    description: string
    test: {
      id: string
      title: string
      questionCount: number
    } | null
    dueDate: string
    status: string
  } | null
}

export function DocumentReaderClient({ document, assignment }: DocumentReaderClientProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const navigateBack = useNavigateBack()
  const { t } = useTranslation()

  const handleTakeTest = () => {
    if (assignment?.test) {
      const testId = String(assignment.test.id)
      router.push(`/test/${testId}`)
    }
  }

  const handleCompleteAssignment = async () => {
    if (!assignment?.id) return
    
    if (!assignment.test) {
      try {
        const response = await fetch(`/api/assignments/${assignment.id}/complete`, {
          method: 'POST'
        })
        const result = await response.json()
        
        if (result.success) {
          // Reload page to show updated status
          router.refresh()
        }
      } catch (error) {
        console.error('Error completing assignment:', error)
      }
    }
  }

  const handleBack = () => {
    const userRole = (session?.user as { role?: string })?.role || 'employee'
    navigateBack(userRole as 'employee' | 'manager' | 'owner', 'assignments')
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <FileText className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 sm:mb-6 text-muted-foreground" />
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground dark:text-white mb-3 sm:mb-4 leading-tight">
            Document Not Found
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 leading-relaxed max-w-md mx-auto">
            The requested document could not be found.
          </p>
          <Button onClick={handleBack} size="lg">
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
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-2 sm:px-6">
          <div className="flex justify-between items-center h-16 sm:h-18">
            <div className="flex items-center min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground dark:text-white truncate leading-tight mb-0.5">
                  {assignment?.name || document.name}
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground truncate leading-relaxed">
                  {document.name}
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
      <main className="max-w-[1200px] mx-auto px-2 sm:px-6 pt-6 sm:pt-8 pb-4 sm:pb-6 md:py-8 lg:py-10">
        <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
          {/* Document Content */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl font-bold leading-tight">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
                    <span className="break-words">{document.name}</span>
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
              {document.type === 'PDF' ? (
                <div className="w-full h-[500px] sm:h-[600px] lg:h-screen border border-border rounded-3xl overflow-hidden">
                  <iframe 
                    src={`/api/documents/${encodeURIComponent(document.name)}`}
                    className="w-full h-full"
                    title={document.name}
                  />
                </div>
              ) : (
                <DocumentRenderer 
                  content={document.content} 
                  tables={document.tables}
                />
              )}
            </CardContent>
          </Card>

          {/* Card Section */}
          {(assignment?.test || assignment) && (
            <div>
              <div className="w-full">
                {/* Test Section */}
                {assignment?.test ? (
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
                          <span>{assignment?.test?.title || t('test')}</span>
                        </p>
                        <p className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                          <strong className="font-semibold text-foreground">{t('questionsLabel')}:</strong>
                          <span>{assignment?.test?.questionCount || 0}</span>
                        </p>
                        <p className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                          <strong className="font-semibold text-foreground">{t('estimatedTime')}:</strong>
                          <span>15 {t('minutes')}</span>
                        </p>
                      </div>
                      
                      <Button 
                        onClick={handleTakeTest}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        disabled={assignment?.status === 'completed'}
                      >
                        <TestTube className="h-4 w-4 mr-2" />
                        {assignment?.status === 'completed' ? t('testCompleted') : t('takeTest')}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  /* No test - show completion button */
                  assignment && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 leading-tight">
                          <span className="text-2xl">📖</span>
                          <span>{t('readingAssignment')}</span>
                        </CardTitle>
                        <CardDescription className="text-sm sm:text-base leading-relaxed mt-2">
                          {assignment.status === 'completed' 
                            ? t('assignmentCompleted') 
                            : t('markAsCompleteAfterReading')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          onClick={handleCompleteAssignment}
                          className="w-full bg-green-600 hover:bg-green-700"
                          disabled={assignment.status === 'completed'}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {assignment.status === 'completed' 
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

