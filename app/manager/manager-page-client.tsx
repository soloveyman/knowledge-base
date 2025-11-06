"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppBar } from "@/components/common/app-bar"
import { EmptyState } from "@/components/common/empty-state"
import { GreetingCard } from "@/components/common/greeting-card"
import { useTranslation } from "@/lib/translation-context"
import { useBadgeTranslation } from "@/lib/badge-translations"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { 
  FileText,
  X,
  Sparkles,
  Loader2
} from "lucide-react"
import { TestsPage } from "@/components/pages/tests-page"
import { AssignmentsPage } from "@/components/pages/assignments-page"
import { DeleteConfirmation } from "@/components/common/delete-confirmation"
import UserProgressReport from "@/components/reports/user-progress-report"
import { cleanupDocumentFromLocalStorage, syncLocalStorageWithDatabase } from "@/lib/localStorage-utils"
import { saveCurrentTab, getTabFromUrl, getPreviousTab } from "@/lib/redirect-utils"
import { formatDateShort } from "@/lib/date-format"

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export interface SavedTest {
  id: string
  title: string
  type: string
  difficulty: string
  locale: string
  questionCount: number
  questions: Array<{
    id: string
    type: string
    prompt: string
    choices?: string[]
    correct_answer?: string
    explanation?: string
  }>
  sourceDocument: string
  createdAt: string
  createdBy: string
}

export interface AssignedUser {
  userId?: string
  id?: string
  status?: string
  testScore?: number | null
}

export interface SavedAssignment {
  id: string
  moduleId: string
  testId?: string | null
  title?: string
  description?: string
  assignedTo: string
  assignedBy: string
  dueDate?: string | null
  status: string
  allowRetake: boolean
  maxAttempts: number
  createdAt: string
  updatedAt: string
  users?: AssignedUser[]
}

export interface SavedDocument {
  id: string
  name: string
  type: string
  uploadedAt: string
  size?: string
  status?: string
  createdAt?: string
  updatedAt?: string
  parsedContent?: {
    metadata?: {
      enhancedBy?: string
      enhancementTimestamp?: number
    }
  } | null
}

export interface SavedUser {
  id: string
  name: string
  job: string
  email: string
  role: string
  createdAt: string
  createdBy: string
  status: string
}

interface ManagerPageClientProps {
  initialDocuments: SavedDocument[]
  initialTests: SavedTest[]
  initialAssignments: SavedAssignment[]
  initialUsers: SavedUser[]
  userId: string
  userName?: string
  userEmail?: string
  userImage?: string
}

export function ManagerPageClient({
  initialDocuments,
  initialTests,
  initialAssignments,
  initialUsers,
  userId,
  userName,
  userEmail,
  userImage
}: ManagerPageClientProps) {
  const { t } = useTranslation()
  const translateBadge = useBadgeTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [documents, setDocuments] = useState<SavedDocument[]>(initialDocuments)
  const [savedTests, setSavedTests] = useState<SavedTest[]>(initialTests)
  const [savedAssignments, setSavedAssignments] = useState<SavedAssignment[]>(initialAssignments)
  const [savedUsers, setSavedUsers] = useState<SavedUser[]>(initialUsers)
  
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false)
  const [isLoadingTests, setIsLoadingTests] = useState(false)
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)
  const [enhancingDocId, setEnhancingDocId] = useState<string | null>(null)
  
  // Get initial tab from URL parameter or sessionStorage
  const defaultTab = useMemo(() => {
    const tabFromUrl = getTabFromUrl(searchParams)
    if (tabFromUrl && ['overview', 'docs', 'tests', 'assignments'].includes(tabFromUrl)) {
      return tabFromUrl
    }
    const previousTab = getPreviousTab('manager')
    if (previousTab && ['overview', 'docs', 'tests', 'assignments'].includes(previousTab)) {
      return previousTab
    }
    return "overview"
  }, [searchParams])

  // Restore tab from sessionStorage on mount if not in URL
  useEffect(() => {
    const tabFromUrl = getTabFromUrl(searchParams)
    if (!tabFromUrl) {
      const previousTab = getPreviousTab('manager')
      if (previousTab && previousTab !== 'overview' && ['overview', 'docs', 'tests', 'assignments'].includes(previousTab)) {
        router.replace(`/manager?tab=${previousTab}`, { scroll: false })
      }
    }
  }, [searchParams, router])

  // Save current tab when it changes
  useEffect(() => {
    if (defaultTab) {
      saveCurrentTab('manager', defaultTab)
    }
  }, [defaultTab])

  // Reload data when needed
  const loadData = useCallback(async (preserveDocuments = false) => {
    try {
      if (preserveDocuments) {
        setIsLoadingDocuments(true)
        setIsLoadingTests(true)
        setIsLoadingAssignments(true)
      }

      const fetchOptions: RequestInit = { cache: 'no-store' }
      const [usersResponse, assignmentsResponse, testsResponse, documentsResponse] = await Promise.all([
        fetch('/api/users', fetchOptions),
        fetch('/api/assignments', fetchOptions),
        fetch('/api/tests', fetchOptions),
        fetch('/api/documents', fetchOptions)
      ])

      const usersResult = await usersResponse.json()
      if (usersResult.success) {
        setSavedUsers(usersResult.data.users)
      }

      const assignmentsResult = await assignmentsResponse.json()
      if (assignmentsResult.success) {
        setSavedAssignments(assignmentsResult.data.assignments)
      }

      const testsResult = await testsResponse.json()
      
      // Read documents response once and reuse it
      const documentsResult = await documentsResponse.json()
      
      if (testsResult.success) {
        const documentMap = new Map<string, { originalFileName?: string; title?: string }>()
        if (documentsResult.success && documentsResult.data.documents) {
          documentsResult.data.documents.forEach((doc: {
            id: string
            originalFileName?: string
            title: string
          }) => {
            documentMap.set(doc.id, { originalFileName: doc.originalFileName, title: doc.title })
          })
        }
        
        const transformedTests = (testsResult.data.tests as Array<{
          id: string
          title: string
          type?: string | null
          difficulty?: string | null
          locale?: string | null
          questionIds?: string[] | null
          moduleId?: string | null
          createdAt: string
          createdBy: string
        }>).map((test) => {
          const questionCount = Array.isArray(test.questionIds) ? test.questionIds.length : 0
          const doc = documentMap.get(test.moduleId || '')
          const sourceDocument = doc?.originalFileName || doc?.title || 'Unknown'
          
          return {
            id: test.id,
            title: test.title,
            type: test.type || 'mcq',
            difficulty: test.difficulty || 'medium',
            locale: test.locale || 'en',
            questionCount,
            questions: [],
            sourceDocument,
            createdAt: test.createdAt,
            createdBy: test.createdBy
          }
        })
        setSavedTests(transformedTests)
      }
      if (documentsResult.success && documentsResult.data.documents) {
        const transformedDocs = documentsResult.data.documents.map((doc: {
          id: string
          originalFileName?: string
          title: string
          fileType?: string
          createdAt: string
          updatedAt?: string
          fileSize?: number
          status?: string
          parsedContent?: {
            metadata?: {
              enhancedBy?: string
              enhancementTimestamp?: number
            }
          } | null
        }) => ({
          id: doc.id,
          name: doc.originalFileName || doc.title,
          type: doc.fileType?.toUpperCase() || 'UNKNOWN',
          uploadedAt: formatDateShort(doc.createdAt),
          size: doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown',
          status: doc.status || 'ready',
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          parsedContent: doc.parsedContent || null
        }))
        setDocuments(transformedDocs)
        syncLocalStorageWithDatabase(transformedDocs)
      } else if (!preserveDocuments) {
        setDocuments([])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      if (!preserveDocuments) {
        setDocuments([])
      }
    } finally {
      setIsLoadingDocuments(false)
      setIsLoadingTests(false)
      setIsLoadingAssignments(false)
    }
  }, [])

  // Reload data when tab changes if data is missing
  useEffect(() => {
    if (defaultTab === 'docs' && documents.length === 0) {
      loadData(false)
    } else if (defaultTab === 'tests' && savedTests.length === 0) {
      loadData(false)
    } else if (defaultTab === 'assignments' && savedAssignments.length === 0) {
      loadData(false)
    } else if (defaultTab === 'overview' && (savedUsers.length === 0 || savedAssignments.length === 0)) {
      loadData(false)
    }
  }, [defaultTab, loadData, documents.length, savedTests.length, savedAssignments.length, savedUsers.length])

  // Reload data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && (defaultTab === 'docs' || defaultTab === 'tests' || defaultTab === 'assignments' || defaultTab === 'overview')) {
        setTimeout(() => loadData(true), 0)
      }
    }

    const handleFocus = () => {
      if (defaultTab === 'docs' || defaultTab === 'tests' || defaultTab === 'assignments' || defaultTab === 'overview') {
        setTimeout(() => loadData(true), 0)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [defaultTab, loadData])

  // Handlers
  const handleEnhanceDocument = async (id: string) => {
    try {
      setEnhancingDocId(id)
      toast.loading('Enhancing document with Grok API...', { id: 'enhance' })
      
      const response = await fetch(`/api/documents/${id}/enhance`, { method: 'POST' })
      const result = await response.json()
      
      if (result.success) {
        toast.success('Document enhanced successfully!', { id: 'enhance' })
        loadData(false)
      } else {
        toast.error(result.message || 'Failed to enhance document', { id: 'enhance' })
      }
    } catch (error) {
      console.error('Error enhancing document:', error)
      toast.error('Error enhancing document', { id: 'enhance' })
    } finally {
      setEnhancingDocId(null)
    }
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      cleanupDocumentFromLocalStorage(id)
      
      const response = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      const result = await response.json()
      
      if (result.success) {
        // Remove from local state immediately
        setDocuments(docs => docs.filter(doc => doc.id !== id))
        toast.success('Document deleted successfully')
      } else {
        loadData(false)
        toast.error(result.message || 'Failed to delete document')
      }
    } catch (error) {
      loadData(false)
      console.error('Error deleting document:', error)
      toast.error('Error deleting document')
    }
  }

  const handleViewDocument = (id: string, name?: string) => {
    const url = `/docs/${encodeURIComponent(id)}`
    router.prefetch(url)
    router.push(url)
  }

  const handleImportDocument = () => {
    router.push('/docs/import?returnTo=/manager?tab=docs')
  }

  const handleDeleteTest = async (id: string) => {
    try {
      setSavedTests(tests => tests.filter(test => test.id !== id))
      
      const response = await fetch(`/api/tests/${id}`, { method: 'DELETE' })
      const result = await response.json()
      
      if (result.success) {
        toast.success('Test deleted successfully')
      } else {
        loadData(false)
        toast.error(result.message || 'Failed to delete test')
      }
    } catch (error) {
      loadData(false)
      console.error('Error deleting test:', error)
      toast.error('Error deleting test')
    }
  }

  const handleViewTest = (id: string) => {
    router.push(`/test/${id}`)
  }

  const handleEditTest = (id: string) => {
    const url = `/test-builder?edit=${id}&returnTo=/manager?tab=tests`
    router.prefetch(url)
    router.push(url)
  }

  const handleDeleteAssignment = async (id: string) => {
    try {
      setSavedAssignments(assignments => assignments.filter(a => a.id !== id))
      
      const response = await fetch(`/api/assignments/${id}`, { method: 'DELETE' })
      const result = await response.json()
      
      if (result.success) {
        toast.success('Assignment deleted successfully')
      } else {
        loadData(false)
        toast.error(result.message || 'Failed to delete assignment')
      }
    } catch (error) {
      loadData(false)
      console.error('Error deleting assignment:', error)
      toast.error('Error deleting assignment')
    }
  }

  const handleViewAssignment = (id: string) => {
    console.log('Open assignment:', id)
  }

  const handleEditAssignment = (id: string) => {
    router.push(`/assignment-builder?edit=${id}`)
  }

  // Memoize completion rate calculation
  const completionStats = useMemo(() => {
    let totalUserAssignments = 0
    let completedUserAssignments = 0
    
    savedAssignments.forEach(assignment => {
      if (assignment.users && Array.isArray(assignment.users)) {
        assignment.users.forEach((au: AssignedUser) => {
          totalUserAssignments++
          if (au.status === 'completed') {
            completedUserAssignments++
          }
        })
      }
    })
    
    return {
      percentage: totalUserAssignments > 0 
        ? Math.round((completedUserAssignments / totalUserAssignments) * 100)
        : 0,
      label: `${completedUserAssignments} of ${totalUserAssignments} ${t('completedOfTotal')}`
    }
  }, [savedAssignments, t])

  return (
    <div className="min-h-screen bg-background">
      <AppBar 
        role="manager" 
        user={{
          name: userName,
          email: userEmail,
          image: userImage
        }}
      />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8">
        <GreetingCard
          name={userName || t('manager')}
        />

        <Tabs value={defaultTab} onValueChange={(value) => {
          if (value && ['overview', 'docs', 'tests', 'assignments'].includes(value)) {
            router.replace(`/manager?tab=${value}`, { scroll: false })
            saveCurrentTab('manager', value)
          }
        }} className="space-y-3 md:space-y-6">
          <div className="tabs-scroll-container">
            <TabsList className="grid w-full min-w-max grid-cols-4">
              <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
              <TabsTrigger value="docs">{t('documents')}</TabsTrigger>
              <TabsTrigger value="tests">{t('tests')}</TabsTrigger>
              <TabsTrigger value="assignments">{t('assignments')}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-3 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total employees</CardTitle>
                  <span className="text-2xl">👥</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{savedUsers.length}</div>
                  <p className="text-xs text-muted-foreground">Team members in the system</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('activeTraining')}</CardTitle>
                  <span className="text-2xl">📋</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{savedAssignments.length}</div>
                  <p className="text-xs text-muted-foreground">{t('totalAssignments')}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('documents')}</CardTitle>
                  <span className="text-2xl">📄</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{documents.length}</div>
                  <p className="text-xs text-muted-foreground">{t('totalDocuments')}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('completionRate')}</CardTitle>
                  <span className="text-2xl">📊</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completionStats.percentage}%</div>
                  <p className="text-xs text-muted-foreground">{completionStats.label}</p>
                </CardContent>
              </Card>
            </div>

            <UserProgressReport 
              users={savedUsers} 
              assignments={savedAssignments.map(a => ({
                id: a.id,
                title: a.title || `${a.moduleId.slice(0, 8)}`,
                description: a.description || '',
                moduleId: a.moduleId,
                testId: a.testId || '',
                assignedTo: a.assignedTo,
                assignedBy: a.assignedBy,
                dueDate: a.dueDate || undefined,
                status: a.status,
                allowRetake: a.allowRetake,
                maxAttempts: a.maxAttempts,
                createdAt: a.createdAt,
                updatedAt: a.updatedAt,
                users: a.users?.map(u => ({
                  userId: u.userId || u.id || '',
                  status: u.status || 'pending'
                })) || []
              }))}
              modules={documents.map(d => ({ id: String(d.id), title: d.name }))}
              tests={savedTests.map(t => ({ id: t.id, title: t.title }))}
            />
          </TabsContent>

          <TabsContent value="docs" className="space-y-3 md:space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <CardTitle><span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">📄</span> <span className="leading-none self-center">{t('uploadedDocuments')}</span></CardTitle>
                    <CardDescription>{t('viewAndManageDocuments')}</CardDescription>
                  </div>
                  <Button 
                    className="w-full sm:w-auto"
                    onClick={handleImportDocument}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {t('importDocument')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingDocuments ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
                    <span className="ml-3 text-muted-foreground">{t('refreshingDocuments')}</span>
                  </div>
                ) : documents.length === 0 ? (
                  <EmptyState
                    icon={<span className="text-5xl">📄</span>}
                    title={t('noDocumentsUploaded')}
                    description={t('getStartedImportDocument')}
                    actionLabel={t('importDocument')}
                    onAction={handleImportDocument}
                  />
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div 
                        key={doc.id}
                        className="flex items-center justify-between p-4 border border-border rounded-3xl hover:bg-accent cursor-pointer gap-3"
                        onClick={() => handleViewDocument(doc.id, doc.name)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground dark:text-white truncate">{doc.name}</h3>
                            {doc.parsedContent?.metadata?.enhancedBy ? (
                              <Badge variant="secondary" className="text-xs">
                                {translateBadge('enhance')}
                              </Badge>
                            ) : doc.updatedAt && doc.createdAt && new Date(doc.updatedAt) > new Date(doc.createdAt) ? (
                              <Badge variant="secondary" className="text-xs">
                                {translateBadge('updated')}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">Uploaded {doc.uploadedAt}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-1">
                          {!doc.parsedContent?.metadata?.enhancedBy && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEnhanceDocument(doc.id)
                              }}
                              disabled={enhancingDocId === doc.id}
                              title="Enhance with Grok API"
                            >
                              {enhancingDocId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <DeleteConfirmation
                            onConfirm={() => handleDeleteDocument(doc.id)}
                            itemName={doc.name}
                            trigger={
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-muted-foreground hover:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tests" className="space-y-3 md:space-y-6">
            <TestsPage
              tests={savedTests}
              onDeleteTest={handleDeleteTest}
              onViewTest={handleViewTest}
              onEditTest={handleEditTest}
              isLoading={isLoadingTests}
            />
          </TabsContent>

          <TabsContent value="assignments" className="space-y-3 md:space-y-6">
            <AssignmentsPage
              assignments={savedAssignments.map(a => {
                const document = documents.find(doc => String(doc.id) === String(a.moduleId))
                
                const test = a.testId ? savedTests.find(t => t.id === a.testId) : null
                
                const assignedUsers = (a.users || []).map((user: AssignedUser) => {
                  const fullUser = savedUsers.find(u => u.id === (user.userId || user.id))
                  return {
                    id: Number(fullUser?.id || user.userId || user.id || 0),
                    name: fullUser?.name || 'Unknown User',
                    email: fullUser?.email || '',
                    role: fullUser?.role || 'employee',
                    department: fullUser?.job || ''
                  }
                })
                
                return {
                  id: a.id,
                  title: a.title || `Assignment ${a.id.slice(0, 8)}`,
                  name: a.title || `Assignment ${a.id.slice(0, 8)}`,
                  description: a.description || '',
                  document: document ? {
                    id: Number(document.id),
                    name: document.name,
                    type: document.type,
                    uploadedAt: document.uploadedAt
                  } : { id: 0, name: 'Document Not Found', type: 'UNKNOWN', uploadedAt: a.createdAt },
                  test: test ? {
                    id: test.id,
                    title: test.title,
                    questionCount: test.questionCount || 0
                  } : a.testId ? { id: a.testId, title: 'Test Not Found', questionCount: 0 } : { id: '', title: 'No Test', questionCount: 0 },
                  assignedUsers: assignedUsers,
                  dueDate: a.dueDate || '',
                  createdAt: a.createdAt,
                  createdBy: a.assignedBy,
                  status: a.status
                }
              })}
              onDeleteAssignment={handleDeleteAssignment}
              onViewAssignment={handleViewAssignment}
              onEditAssignment={handleEditAssignment}
              isLoading={isLoadingAssignments}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

