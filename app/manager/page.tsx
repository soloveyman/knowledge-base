"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useMemo, useLayoutEffect, useCallback, Suspense } from "react"
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
import { cleanupDocumentFromLocalStorage, syncLocalStorageWithDatabase, fixCorruptedLocalStorage } from "@/lib/localStorage-utils"

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
import { saveCurrentTab, getTabFromUrl } from "@/lib/redirect-utils"
import { formatDateShort } from "@/lib/date-format"

interface SavedTest {
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

interface AssignedUser {
  userId?: string
  id?: string
  status?: string
  testScore?: number | null
}

interface SavedAssignment {
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

function ManagerPageInner() {
  const { data: session, status } = useSession()
  const { t } = useTranslation()
  const translateBadge = useBadgeTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  // Initialize tests from localStorage to prevent empty state on re-mount
  const [savedTests, setSavedTests] = useState<SavedTest[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('manager-tests')
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })
  // Initialize assignments from localStorage to prevent empty state on re-mount
  const [savedAssignments, setSavedAssignments] = useState<SavedAssignment[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('manager-assignments')
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })
  const [savedUsers, setSavedUsers] = useState<Array<{
    id: string
    name: string
    job: string
    email: string
    role: string
    createdAt: string
    createdBy: string
    status: string
  }>>([])
  
  // Initialize documents from localStorage to prevent empty state on re-mount
  const [documents, setDocuments] = useState<Array<{
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
  }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('manager-documents')
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })
  
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false)
  const [isLoadingTests, setIsLoadingTests] = useState(false)
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)

  // Debug wrapper for setDocuments
  const setDocumentsWithLog = (newDocuments: Array<{
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
  }>) => {
    console.log('Manager: setDocuments called with:', newDocuments.length, 'documents')
    if (newDocuments.length === 0) {
      console.log('Manager: WARNING - Documents being cleared!')
      console.trace('Manager: Stack trace for document clearing:')
    } else {
      // Save to localStorage to persist across re-mounts
      try {
        localStorage.setItem('manager-documents', JSON.stringify(newDocuments))
      } catch (error) {
        console.error('Failed to save documents to localStorage:', error)
      }
    }
    setDocuments(newDocuments)
  }

  // Debug wrapper for setSavedTests
  const setSavedTestsWithLog = (newTests: SavedTest[]) => {
    console.log('Manager: setSavedTests called with:', newTests.length, 'tests')
    if (newTests.length === 0) {
      console.log('Manager: WARNING - Tests being cleared!')
      console.trace('Manager: Stack trace for test clearing:')
    } else {
      // Save to localStorage to persist across re-mounts
      try {
        localStorage.setItem('manager-tests', JSON.stringify(newTests))
      } catch (error) {
        console.error('Failed to save tests to localStorage:', error)
      }
    }
    setSavedTests(newTests)
  }

  // Debug wrapper for setSavedAssignments
  const setSavedAssignmentsWithLog = (newAssignments: SavedAssignment[]) => {
    console.log('Manager: setSavedAssignments called with:', newAssignments.length, 'assignments')
    if (newAssignments.length === 0) {
      console.log('Manager: WARNING - Assignments being cleared!')
      console.trace('Manager: Stack trace for assignment clearing:')
    } else {
      // Save to localStorage to persist across re-mounts
      try {
        localStorage.setItem('manager-assignments', JSON.stringify(newAssignments))
      } catch (error) {
        console.error('Failed to save assignments to localStorage:', error)
      }
    }
    setSavedAssignments(newAssignments)
  }

  // Initialize with empty array and log it
  console.log('Manager: Initial documents state:', documents.length, 'documents')

  // Fix any corrupted localStorage data on initialization
  useEffect(() => {
    fixCorruptedLocalStorage()
  }, [])

  // Monitor documents state changes
  useEffect(() => {
    console.log('Manager: Documents state changed to:', documents.length, 'documents')
  }, [documents])
  
  // Get initial tab from URL parameter using useMemo to prevent re-renders
  const defaultTab = useMemo(() => {
    const tab = getTabFromUrl(searchParams)
    return tab && ['overview', 'docs', 'tests', 'assignments'].includes(tab) ? tab : "overview"
  }, [searchParams])

  // Save current tab when it changes
  useEffect(() => {
    if (defaultTab) {
      saveCurrentTab('manager', defaultTab)
    }
  }, [defaultTab])

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Role-based redirects are now handled by middleware
  }, [session, status, router])

  // Load data from APIs - parallel fetching for faster loading
  const loadData = useCallback(async (preserveDocuments = false) => {
    try {
      // Set loading states if we're refreshing
      if (preserveDocuments) {
        setIsLoadingDocuments(true)
        setIsLoadingTests(true)
        setIsLoadingAssignments(true)
      }

      // Fetch all data in parallel for instant loading
      // Always use cache: 'no-store' to ensure fresh data on reload
      const fetchOptions: RequestInit = { cache: 'no-store' }
      const [usersResponse, assignmentsResponse, testsResponse, documentsResponse] = await Promise.all([
        fetch('/api/users', fetchOptions),
        fetch('/api/assignments', fetchOptions),
        fetch('/api/tests', fetchOptions),
        fetch('/api/documents', fetchOptions)
      ])

      // Process users
      const usersResult = await usersResponse.json()
      if (usersResult.success) {
        setSavedUsers(usersResult.data.users)
      }

      // Process assignments
      const assignmentsResult = await assignmentsResponse.json()
      if (assignmentsResult.success) {
        console.log('Manager: Loaded assignments from API:', assignmentsResult.data.assignments)
        setSavedAssignmentsWithLog(assignmentsResult.data.assignments)
      }

      // Process documents first (needed for test sourceDocument lookup)
      const documentsResult = await documentsResponse.json()
      
      // Create document lookup map for fast access (avoids individual fetches per test)
      const documentMap = new Map<string, { originalFileName?: string; title?: string }>()
      if (documentsResult.success && documentsResult.data.documents) {
        documentsResult.data.documents.forEach((doc: {
          id: string
          originalFileName?: string
          title: string
        }) => {
          documentMap.set(doc.id, { originalFileName: doc.originalFileName, title: doc.title })
        })
        
        // Transform database documents to match the expected format
        console.log('Manager: Raw documents from API:', documentsResult.data.documents)
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
        console.log('Manager: Transformed documents:', transformedDocs)
        setDocumentsWithLog(transformedDocs)
        
        // Sync localStorage with database to remove stale data
        syncLocalStorageWithDatabase(transformedDocs)
      } else if (!preserveDocuments) {
        // Only clear documents if we're not preserving them and the API call failed
        setDocumentsWithLog([])
      }

      // Process tests (use document map instead of individual fetches)
      const testsResult = await testsResponse.json()
      if (testsResult.success) {
        // Transform tests to match the expected format (no async needed now)
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
          // Calculate questionCount from questionIds
          const questionCount = Array.isArray(test.questionIds) ? test.questionIds.length : 0
          
          // Get sourceDocument from map (much faster than individual fetch)
          let sourceDocument = 'Unknown'
          if (test.moduleId) {
            const doc = documentMap.get(test.moduleId)
            if (doc) {
              sourceDocument = doc.originalFileName || doc.title || 'Unknown'
            }
          }
          
          return {
            id: test.id,
            title: test.title,
            type: test.type || 'mcq',
            difficulty: test.difficulty || 'medium',
            locale: test.locale || 'en',
            questionCount,
            questions: [], // Not needed for the card display
            sourceDocument,
            createdAt: test.createdAt,
            createdBy: test.createdBy
          }
        })
        setSavedTestsWithLog(transformedTests)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      if (!preserveDocuments) {
        setDocumentsWithLog([])
      }
    } finally {
      // Clear loading states
      setIsLoadingDocuments(false)
      setIsLoadingTests(false)
      setIsLoadingAssignments(false)
    }
  }, [])

  useLayoutEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    const fetchData = async () => {
      await loadData()
    }
    fetchData()
  }, [loadData])

  // Only reload data when tab changes if data is missing
  // This prevents unnecessary delays when switching tabs
  useEffect(() => {
    // Skip reload if data already exists (instant render like overview tab)
    if (defaultTab === 'docs' && documents.length === 0) {
      console.log('Manager: Docs tab activated, loading documents...')
      loadData(false)
    } else if (defaultTab === 'tests' && savedTests.length === 0) {
      console.log('Manager: Tests tab activated, loading tests...')
      loadData(false)
    } else if (defaultTab === 'assignments' && savedAssignments.length === 0) {
      console.log('Manager: Assignments tab activated, loading assignments...')
      loadData(false)
    } else if (defaultTab === 'overview' && (documents.length === 0 || savedTests.length === 0 || savedAssignments.length === 0)) {
      console.log('Manager: Overview tab activated, loading missing data...')
      loadData(false)
    }
  }, [defaultTab, loadData, documents.length, savedTests.length, savedAssignments.length])

  // Reload tests when returning from test-builder (detected via URL change)
  // Only reload if data is missing to avoid unnecessary delays
  useEffect(() => {
    const tab = getTabFromUrl(searchParams)
    if (tab === 'tests' && savedTests.length === 0) {
      // Load immediately without delay (router navigation is already complete)
      console.log('Manager: Detected tests tab in URL, loading tests...')
      loadData(false)
    }
  }, [searchParams, loadData, savedTests.length])

  // Reload data when page becomes visible (e.g., when returning from document viewer)
  // Only reload if data is missing to avoid unnecessary delays
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Only reload if data is missing for the current tab
        if (defaultTab === 'docs' && documents.length === 0) {
          console.log('Manager: Page became visible, loading documents...')
          loadData(false)
        } else if (defaultTab === 'tests' && savedTests.length === 0) {
          console.log('Manager: Page became visible, loading tests...')
          loadData(false)
        } else if (defaultTab === 'assignments' && savedAssignments.length === 0) {
          console.log('Manager: Page became visible, loading assignments...')
          loadData(false)
        }
      }
    }

    const handleFocus = () => {
      // Only reload if data is missing for the current tab
      if (defaultTab === 'docs' && documents.length === 0) {
        console.log('Manager: Window focused, loading documents...')
        loadData(false)
      } else if (defaultTab === 'tests' && savedTests.length === 0) {
        console.log('Manager: Window focused, loading tests...')
        loadData(false)
      } else if (defaultTab === 'assignments' && savedAssignments.length === 0) {
        console.log('Manager: Window focused, loading assignments...')
        loadData(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [defaultTab, loadData])


  // Document handlers
  const [enhancingDocId, setEnhancingDocId] = useState<string | null>(null)

  const handleEnhanceDocument = async (id: string) => {
    try {
      setEnhancingDocId(id)
      toast.loading('Enhancing document with Grok API...', { id: 'enhance' })
      
      const response = await fetch(`/api/documents/${id}/enhance`, {
        method: 'POST'
      })
      const result = await response.json()
      
      if (result.success) {
        toast.success('Document enhanced successfully!', { id: 'enhance' })
        // Reload documents to show updated content
        loadData(false)
      } else {
        console.error('Failed to enhance document:', result.message)
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
      // Optimistically update UI immediately
      setDocumentsWithLog(documents.filter(doc => doc.id !== id))
      cleanupDocumentFromLocalStorage(id)
      
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      
      if (result.success) {
        toast.success('Document deleted successfully')
      } else {
        // Revert on error - reload data
        loadData(false)
        console.error('Failed to delete document:', result.message)
        toast.error(result.message || 'Failed to delete document')
      }
    } catch (error) {
      // Revert on error - reload data
      loadData(false)
      console.error('Error deleting document:', error)
      toast.error('Error deleting document')
    }
  }

  const handleViewDocument = (id: string, name?: string) => {
    console.log('📄 Manager: handleViewDocument called')
    console.log('📄 ID:', id, 'ID type:', typeof id, 'Name:', name)
    // Use ID for navigation - more reliable than name
    const encodedId = encodeURIComponent(String(id))
    const url = `/docs/${encodedId}`
    console.log('📄 Navigating to:', url)
    // Prefetch for instant navigation
    router.prefetch(url)
    router.push(url)
  }

  const handleImportDocument = () => {
    router.push('/docs/import?returnTo=/manager?tab=docs')
  }

  // Test handlers
  const handleDeleteTest = async (id: string) => {
    try {
      // Optimistically update UI immediately
      setSavedTestsWithLog(savedTests.filter(test => test.id !== id))
      
      const response = await fetch(`/api/tests/${id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      
      if (result.success) {
        toast.success('Test deleted successfully')
      } else {
        // Revert on error - reload data
        loadData(false)
        console.error('Failed to delete test:', result.message)
        toast.error(result.message || 'Failed to delete test')
      }
    } catch (error) {
      // Revert on error - reload data
      loadData(false)
      console.error('Error deleting test:', error)
      toast.error('Error deleting test')
    }
  }

  const handleViewTest = (id: string) => {
    console.log('Open test:', id)
  }

  const handleEditTest = (id: string) => {
    // Redirect to test builder with edit parameter and returnTo
    const url = `/test-builder?edit=${id}&returnTo=/manager?tab=tests`
    router.prefetch(url)
    router.push(url)
  }

  // Assignment handlers
  const handleDeleteAssignment = async (id: string) => {
    try {
      // Optimistically update UI immediately
      setSavedAssignmentsWithLog(savedAssignments.filter(a => a.id !== id))
      
      const response = await fetch(`/api/assignments/${id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      
      if (result.success) {
        toast.success('Assignment deleted successfully')
      } else {
        // Revert on error - reload data
        loadData(false)
        console.error('Failed to delete assignment:', result.message)
        toast.error(result.message || 'Failed to delete assignment')
      }
    } catch (error) {
      // Revert on error - reload data
      loadData(false)
      console.error('Error deleting assignment:', error)
      toast.error('Error deleting assignment')
    }
  }

  const handleViewAssignment = (id: string) => {
    console.log('Open assignment:', id)
  }

  const handleEditAssignment = (id: string) => {
    // Redirect to assignment builder with edit parameter
    router.push(`/assignment-builder?edit=${id}`)
  }

  // Don't block UI while session loads - show page immediately
  if (status === "loading") {
    // Show page but with disabled state - don't block with spinner
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <AppBar 
        role="manager" 
        user={{
          name: session.user?.name,
          email: session.user?.email,
          image: session.user?.image
        }}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 md:py-8">
        <GreetingCard
          name={session.user?.name || t('manager')}
        />


        {/* Main Tabs */}
        <Tabs defaultValue={defaultTab} className="space-y-3 md:space-y-6">
          <div className="tabs-scroll-container">
            <TabsList className="grid w-full min-w-max grid-cols-4">
            <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
            <TabsTrigger value="docs">{t('documents')}</TabsTrigger>
            <TabsTrigger value="tests">{t('tests')}</TabsTrigger>
            <TabsTrigger value="assignments">{t('assignments')}</TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-3 md:space-y-6">
            {/* Overview Metrics */}
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
                  <div className="text-2xl font-bold">
                    {(() => {
                      // Count completed assignments from assignment_users table
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
                      
                      return totalUserAssignments > 0 
                        ? Math.round((completedUserAssignments / totalUserAssignments) * 100)
                        : 0
                    })()}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
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
                      
                      return `${completedUserAssignments} of ${totalUserAssignments} ${t('completedOfTotal')}`
                    })()}
                  </p>
                </CardContent>
              </Card>
            </div>

            {(() => { console.log('Manager: Rendering UserProgressReport with:', savedUsers.length, 'users and', savedAssignments.length, 'assignments'); return null; })()}
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
                // Find the document that matches this assignment's moduleId
                // Documents in manager page don't have moduleId, so match by ID
                const document = documents.find(doc => String(doc.id) === String(a.moduleId))
                
                // Find the test that matches this assignment's testId
                const test = a.testId ? savedTests.find(t => t.id === a.testId) : null
                
                // Map assigned users from the users array
                const assignedUsers = (a.users || []).map((user: AssignedUser) => {
                  // Find the full user details from savedUsers
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

export default function ManagerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div></div>}>
      <ManagerPageInner />
    </Suspense>
  )
}
