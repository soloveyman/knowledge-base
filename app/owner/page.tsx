"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useMemo, useLayoutEffect, useCallback, Suspense, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UsersPage } from "@/components/pages/users-page"
import { TestsPage } from "@/components/pages/tests-page"
import { AssignmentsPage } from "@/components/pages/assignments-page"
import { AppBar } from "@/components/common/app-bar"
import { EmptyState } from "@/components/common/empty-state"
import { DeleteConfirmation } from "@/components/common/delete-confirmation"
import { GreetingCard } from "@/components/common/greeting-card"
import UserProgressReport from "@/components/reports/user-progress-report"
import SubscriptionManager from "@/components/subscription/subscription-manager"
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
import { saveCurrentTab, getTabFromUrl, getPreviousTab } from "@/lib/redirect-utils"
import { cleanupDocumentFromLocalStorage, fixCorruptedLocalStorage } from "@/lib/localStorage-utils"
import { formatDateShort } from "@/lib/date-format"

// Component to handle tabs overflow detection
function TabsContainer({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkOverflow = () => {
      if (!containerRef.current) return
      
      const container = containerRef.current
      const tabsList = container.querySelector('[data-slot="tabs-list"]') as HTMLElement
      
      if (!tabsList) return
      
      // Check if tabs list overflows container
      const hasOverflow = tabsList.scrollWidth > container.clientWidth
      
      if (hasOverflow) {
        container.classList.add('tabs-overflow')
      } else {
        container.classList.remove('tabs-overflow')
      }
    }

    // Check on mount with a small delay to ensure DOM is ready
    setTimeout(checkOverflow, 0)
    window.addEventListener('resize', checkOverflow)
    
    // Use ResizeObserver for more accurate detection
    const resizeObserver = new ResizeObserver(checkOverflow)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
      const tabsList = containerRef.current.querySelector('[data-slot="tabs-list"]')
      if (tabsList) {
        resizeObserver.observe(tabsList)
      }
    }

    return () => {
      window.removeEventListener('resize', checkOverflow)
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="tabs-scroll-container">
      {children}
    </div>
  )
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

interface SavedUser {
  id: string
  name: string
  job: string
  email: string
  role: string
  createdAt: string
  createdBy: string
  status: string
}

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
  title?: string
  description?: string
  moduleId: string
  testId: string | null
  assignedTo: string
  assignedBy: string
  dueDate: string | null
  status: string
  allowRetake: boolean
  maxAttempts: number
  createdAt: string
  updatedAt: string
  users?: AssignedUser[]
}

interface SavedDocument {
  id: string
  name: string
  type: string
  uploadedAt: string
  size?: string
  status?: string
  moduleId?: string | null
  createdAt?: string
  updatedAt?: string
  parsedContent?: {
    metadata?: {
      enhancedBy?: string
      enhancementTimestamp?: number
    }
  } | null
}

function OwnerPageInner() {
  const { data: session, status } = useSession()
  const { t } = useTranslation()
  const translateBadge = useBadgeTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Initialize tests from localStorage to prevent empty state on refresh
  const [savedTests, setSavedTests] = useState<SavedTest[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('owner-tests')
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })
  
  // Initialize assignments from localStorage to prevent empty state on refresh
  const [savedAssignments, setSavedAssignments] = useState<SavedAssignment[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('owner-assignments')
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })
  
  // Initialize documents from localStorage to prevent empty state on refresh
  const [documents, setDocuments] = useState<SavedDocument[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('owner-documents')
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })
  
  const [savedUsers, setSavedUsers] = useState<SavedUser[]>([])
  
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false)
  const [isLoadingTests, setIsLoadingTests] = useState(false)
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)

  // Set documents with localStorage persistence for smoother reloads
  const setDocumentsWithLog = (newDocuments: SavedDocument[]) => {
    setDocuments(newDocuments)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('owner-documents', JSON.stringify(newDocuments))
      } catch (error) {
        console.error('Error saving documents to localStorage:', error)
      }
    }
  }

  // Set tests with localStorage persistence for smoother reloads
  const setSavedTestsWithLog = (newTests: SavedTest[]) => {
    setSavedTests(newTests)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('owner-tests', JSON.stringify(newTests))
      } catch (error) {
        console.error('Error saving tests to localStorage:', error)
      }
    }
  }

  // Set assignments with localStorage persistence for smoother reloads
  const setSavedAssignmentsWithLog = (newAssignments: SavedAssignment[]) => {
    setSavedAssignments(newAssignments)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('owner-assignments', JSON.stringify(newAssignments))
      } catch (error) {
        console.error('Error saving assignments to localStorage:', error)
      }
    }
  }

  // Get initial tab from URL parameter or sessionStorage using useMemo to prevent re-renders
  const defaultTab = useMemo(() => {
    const tabFromUrl = getTabFromUrl(searchParams)
    if (tabFromUrl && ['overview', 'users', 'docs', 'tests', 'assignments', 'settings'].includes(tabFromUrl)) {
      return tabFromUrl
    }
    // If no tab in URL, try to get from sessionStorage
    const previousTab = getPreviousTab('owner')
    if (previousTab && ['overview', 'users', 'docs', 'tests', 'assignments', 'settings'].includes(previousTab)) {
      return previousTab
    }
    // Default to overview
    return "overview"
  }, [searchParams])

  // Restore tab from sessionStorage on mount if not in URL
  useEffect(() => {
    const tabFromUrl = getTabFromUrl(searchParams)
    if (!tabFromUrl) {
      const previousTab = getPreviousTab('owner')
      if (previousTab && previousTab !== 'overview' && ['overview', 'users', 'docs', 'tests', 'assignments', 'settings'].includes(previousTab)) {
        // Update URL to include the restored tab
        router.replace(`/owner?tab=${previousTab}`, { scroll: false })
      }
    }
  }, [searchParams, router]) // Run when searchParams change

  // Save current tab when it changes
  useEffect(() => {
    if (defaultTab) {
      saveCurrentTab('owner', defaultTab)
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
      // Use cache: 'no-store' to force fresh data when switching tabs
      const fetchOptions: RequestInit = preserveDocuments ? { cache: 'no-store' } : {}
      const [usersResponse, assignmentsResponse, testsResponse, documentsResponse] = await Promise.all([
        fetch('/api/users', fetchOptions),
        fetch('/api/assignments', fetchOptions),
        fetch('/api/tests', fetchOptions),
        fetch('/api/documents', fetchOptions)
      ])

      // Process users
      const usersResult = await usersResponse.json()
      if (usersResult.success) {
        // Exclude the signed-in owner from the Users tab to reflect team members only
        setSavedUsers((usersResult.data.users as SavedUser[]).filter(u => u.id !== (session?.user?.id || '')))
      }

      // Process assignments
      const assignmentsResult = await assignmentsResponse.json()
      if (assignmentsResult.success) {
        console.log('Owner: Loaded assignments from API:', assignmentsResult.data.assignments)
        setSavedAssignmentsWithLog(assignmentsResult.data.assignments)
      }

      // Process tests
      const testsResult = await testsResponse.json()
      if (testsResult.success) {
        // Transform tests to match the expected format
        const transformedTests = await Promise.all(
          (testsResult.data.tests as Array<{
            id: string
            title: string
            type?: string | null
            difficulty?: string | null
            locale?: string | null
            questionIds?: string[] | null
            moduleId?: string | null
            createdAt: string
            createdBy: string
          }>).map(async (test) => {
            // Calculate questionCount from questionIds
            const questionCount = Array.isArray(test.questionIds) ? test.questionIds.length : 0
            
            // Fetch document to get sourceDocument name
            let sourceDocument = 'Unknown'
            if (test.moduleId) {
              try {
                const docResponse = await fetch(`/api/documents/${test.moduleId}`, { cache: 'no-store' })
                const docResult = await docResponse.json()
                if (docResult.success && docResult.data.document) {
                  sourceDocument = docResult.data.document.originalFileName || docResult.data.document.title || 'Unknown'
                }
              } catch (error) {
                console.error('Error fetching document for test:', error)
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
        )
        setSavedTestsWithLog(transformedTests)
      }

      // Process documents (already fetched in parallel above)
      console.log('Owner: Loading documents, session user:', session?.user)
      console.log('Owner: Session businessId:', session?.user?.businessId)
      const documentsResult = await documentsResponse.json()
      console.log('Owner: Documents API response:', documentsResult)
      if (documentsResult.success) {
        console.log('Owner: Raw documents from API:', documentsResult.data.documents)
        console.log('Owner: Number of documents:', documentsResult.data.documents?.length || 0)
        
        // Check if documents array exists and has items
        if (documentsResult.data.documents && Array.isArray(documentsResult.data.documents) && documentsResult.data.documents.length > 0) {
          // Transform database documents to match the expected format
          const transformedDocs = documentsResult.data.documents.map((doc: {
            id: string
            originalFileName?: string
            title: string
            fileType?: string
            createdAt: string
            updatedAt?: string
            fileSize?: number
            status?: string
            moduleId?: string | null
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
            moduleId: doc.moduleId || null,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            parsedContent: doc.parsedContent || null
          }))
          console.log('Owner: Transformed documents:', transformedDocs)
          setDocumentsWithLog(transformedDocs)
        } else {
          console.log('Owner: No documents in API response, keeping existing documents if any')
          // Don't clear documents if preserveDocuments is true
          if (!preserveDocuments) {
            setDocumentsWithLog([])
          }
        }
        
        // Note: syncLocalStorageWithDatabase is manager-specific, so we handle it via setDocumentsWithLog
        // which always saves to owner-documents localStorage key
      } else {
        console.error('Owner: Documents API failed:', documentsResult.message || documentsResult.error)
        if (!preserveDocuments) {
          // Only clear documents if we're not preserving them and the API call failed
          setDocumentsWithLog([])
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  useLayoutEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    const fetchData = async () => {
      await loadData()
      // Preload subscription data in parallel (non-blocking) for instant tab switch
      fetch('/api/subscription', { cache: 'no-store' }).catch(() => {
        // Silently fail - SubscriptionManager will load it if needed
      })
    }
    fetchData()
  }, [loadData])

  // Only reload data when tab changes if data is missing or stale
  // This prevents unnecessary delays when switching tabs
  useEffect(() => {
    // Skip reload if data already exists (instant render like overview/users tabs)
    if (defaultTab === 'docs' && documents.length === 0) {
      console.log('Owner: Docs tab activated, loading documents...')
      loadData(false)
    } else if (defaultTab === 'tests' && savedTests.length === 0) {
      console.log('Owner: Tests tab activated, loading tests...')
      loadData(false)
    } else if (defaultTab === 'assignments' && savedAssignments.length === 0) {
      console.log('Owner: Assignments tab activated, loading assignments...')
      loadData(false)
    } else if (defaultTab === 'overview' && (savedUsers.length === 0 || savedAssignments.length === 0)) {
      console.log('Owner: Overview tab activated, loading missing data...')
      loadData(false)
    }
  }, [defaultTab, loadData, documents.length, savedTests.length, savedAssignments.length, savedUsers.length])

  // Reload tests when returning from test-builder (detected via URL change)
  // Only reload if data is missing to avoid unnecessary delays
  useEffect(() => {
    const tab = getTabFromUrl(searchParams)
    if (tab === 'tests' && savedTests.length === 0) {
      // Load immediately without delay (router navigation is already complete)
      console.log('Owner: Detected tests tab in URL, loading tests...')
      loadData(false)
    }
  }, [searchParams, loadData, savedTests.length])

  // Reload data when tab changes to settings
  useEffect(() => {
    if (defaultTab === 'settings') {
      console.log('Owner: Settings tab activated')
      // Settings tab will handle its own data loading via SubscriptionManager
    }
  }, [defaultTab])

  // Reload data when page becomes visible (e.g., when returning from document viewer)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && (defaultTab === 'docs' || defaultTab === 'tests' || defaultTab === 'assignments' || defaultTab === 'overview')) {
        console.log('Owner: Page became visible, reloading data...')
        setTimeout(() => loadData(true), 0)
      }
    }

    const handleFocus = () => {
      if (defaultTab === 'docs' || defaultTab === 'tests' || defaultTab === 'assignments' || defaultTab === 'overview') {
        console.log('Owner: Window focused, reloading data...')
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
    console.log('Owner: handleViewDocument called with id:', id, 'name:', name)
    // Use ID for navigation - more reliable than name
    const url = `/docs/${encodeURIComponent(id)}`
    // Prefetch for instant navigation
    router.prefetch(url)
    router.push(url)
  }

  const handleImportDocument = () => {
    router.push('/docs/import?returnTo=/owner?tab=docs')
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
    router.push(`/test/${id}`)
  }

  const handleEditTest = (id: string) => {
    const url = `/test-builder?edit=${id}&returnTo=/owner?tab=tests`
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
    const url = `/assignment-builder?edit=${id}&returnTo=/owner?tab=assignments`
    router.prefetch(url)
    router.push(url)
  }

  // User handlers
  const handleDeleteUser = async (id: string) => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      
      if (result.success) {
        setSavedUsers(prev => prev.filter(u => u.id !== id))
      } else {
        console.error('Failed to delete user:', result.message)
      }
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  const handleViewUser = (id: string) => {
    console.log('View user:', id)
  }

  const handleEditUser = (id: string) => {
    router.push(`/user-builder?edit=${id}`)
  }

  if (status === "loading") {
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
      <AppBar 
        role="owner" 
        user={{
          name: session.user?.name,
          email: session.user?.email,
          image: session.user?.image
        }}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 md:py-8">
        <GreetingCard
          name={session.user?.name || t('owner')}
        />

        {/* Main Tabs */}
        <Tabs value={defaultTab} onValueChange={(value) => {
          if (value && ['overview', 'users', 'docs', 'tests', 'assignments', 'settings'].includes(value)) {
            router.replace(`/owner?tab=${value}`, { scroll: false })
            saveCurrentTab('owner', value)
          }
        }} className="space-y-3 md:space-y-6">
          <TabsContainer>
            <TabsList className="w-full min-w-max grid grid-cols-3 sm:grid-cols-6">
              <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
              <TabsTrigger value="users">{t('users')}</TabsTrigger>
              <TabsTrigger value="docs">{t('documents')}</TabsTrigger>
              <TabsTrigger value="tests">{t('tests')}</TabsTrigger>
              <TabsTrigger value="assignments">{t('assignments')}</TabsTrigger>
              <TabsTrigger value="settings">{t('subscriptions')}</TabsTrigger>
            </TabsList>
          </TabsContainer>

          <TabsContent value="overview" className="space-y-3 md:space-y-6">
            {/* Overview Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-6 items-stretch">
              <Card className="flex flex-col h-full min-h-[140px] md:min-h-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-4 md:px-6">
                  <CardTitle className="text-base md:text-sm font-medium">{t('totalUsers')}</CardTitle>
                  <span className="text-2xl">👥</span>
                </CardHeader>
                <CardContent className="pt-2 pb-2 px-4 md:px-6 flex-1 flex flex-col justify-between">
                  <div className="text-2xl font-bold">{savedUsers.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {savedUsers.filter(u => u.role === 'manager').length} {t('managers')}, {savedUsers.filter(u => u.role === 'employee').length} {t('employees')}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="flex flex-col h-full min-h-[140px] md:min-h-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-4 md:px-6">
                  <CardTitle className="text-base md:text-sm font-medium">{t('activeTraining')}</CardTitle>
                  <span className="text-2xl">📋</span>
                </CardHeader>
                <CardContent className="pt-4 px-4 md:px-6 pb-2 flex-1 flex flex-col justify-between">
                  <div className="text-2xl font-bold">{savedAssignments.length}</div>
                  <p className="text-xs text-muted-foreground">{t('totalAssignments')}</p>
                </CardContent>
              </Card>
              
              <Card className="flex flex-col h-full min-h-[140px] md:min-h-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-4 md:px-6">
                  <CardTitle className="text-base md:text-sm font-medium">{t('documents')}</CardTitle>
                  <span className="text-2xl">📄</span>
                </CardHeader>
                <CardContent className="pt-4 px-4 md:px-6 pb-2 flex-1 flex flex-col justify-between">
                  <div className="text-2xl font-bold">{documents.length}</div>
                  <p className="text-xs text-muted-foreground">{t('totalDocuments')}</p>
                </CardContent>
              </Card>
              
              <Card className="flex flex-col h-full min-h-[140px] md:min-h-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-4 md:px-6">
                  <CardTitle className="text-base md:text-sm font-medium">{t('completionRate')}</CardTitle>
                  <span className="text-2xl">📊</span>
                </CardHeader>
                <CardContent className="pt-4 px-4 md:px-6 pb-2 flex-1 flex flex-col justify-between">
                  <div className="text-2xl font-bold">
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
                      
                      return totalUserAssignments > 0 
                        ? Math.round((completedUserAssignments / totalUserAssignments) * 100)
                        : 0
                    })()}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
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
                dueDate: a.dueDate || '',
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

          <TabsContent value="users" className="space-y-3 md:space-y-6">
            <UsersPage
              users={savedUsers}
              onDeleteUser={handleDeleteUser}
              onViewUser={handleViewUser}
              onEditUser={handleEditUser}
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
                // Assignment stores moduleId (module ID), document also has moduleId
                const document = documents.find(doc => {
                  // Match document's moduleId with assignment's moduleId
                  if (doc.moduleId && a.moduleId) {
                    return String(doc.moduleId) === String(a.moduleId)
                  }
                  return false
                }) || documents.find(doc => String(doc.id) === String(a.moduleId)) // Fallback: try direct ID match (for backwards compatibility)
                
                // Find the test that matches this assignment's testId
                const test = a.testId ? savedTests.find(t => t.id === a.testId) : null
                
                // Map assigned users from the users array
                const assignedUsers = (a.users || []).map(user => {
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
                  title: a.title,
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

          <TabsContent value="settings" className="space-y-3 md:space-y-6">
            <SubscriptionManager />
          </TabsContent>

        </Tabs>
      </main>
    </div>
  )
}

export default function OwnerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div></div>}>
      <OwnerPageInner />
    </Suspense>
  )
}
