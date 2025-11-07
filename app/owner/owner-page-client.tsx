"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppBar } from "@/components/common/app-bar"
import { EmptyState } from "@/components/common/empty-state"
import { DeleteConfirmation } from "@/components/common/delete-confirmation"
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
import { saveCurrentTab, getTabFromUrl, getPreviousTab } from "@/lib/redirect-utils"
import { cleanupDocumentFromLocalStorage, syncLocalStorageWithDatabase, clearAllDocumentLocalStorage } from "@/lib/localStorage-utils"
import { formatDateShort } from "@/lib/date-format"
import dynamic from "next/dynamic"

// Lazy load heavy tab components with optimized loading states
const UsersPage = dynamic(() => import("@/components/pages/users-page").then(mod => ({ default: mod.UsersPage })), {
  loading: () => <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div></div>,
  ssr: false // Disable SSR for heavy client components
})
const TestsPage = dynamic(() => import("@/components/pages/tests-page").then(mod => ({ default: mod.TestsPage })), {
  loading: () => <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div></div>,
  ssr: false
})
const AssignmentsPage = dynamic(() => import("@/components/pages/assignments-page").then(mod => ({ default: mod.AssignmentsPage })), {
  loading: () => <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div></div>,
  ssr: false
})
const UserProgressReport = dynamic(() => import("@/components/reports/user-progress-report"), {
  loading: () => <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div></div>,
  ssr: false
})
const SubscriptionManager = dynamic(() => import("@/components/subscription/subscription-manager"), {
  loading: () => <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div></div>,
  ssr: false
})

// Types
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

export interface SavedAssignment {
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
  users?: Array<{ userId?: string; id?: string; status?: string; testScore?: number | null }>
}

export interface SavedDocument {
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

interface OwnerPageClientProps {
  initialDocuments: SavedDocument[]
  initialTests: SavedTest[]
  initialAssignments: SavedAssignment[]
  initialUsers: SavedUser[]
  userId: string
  userName?: string
  userEmail?: string
  userImage?: string
}

// Component to handle tabs overflow detection
function TabsContainer({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkOverflow = () => {
      if (!containerRef.current) return
      
      const container = containerRef.current
      const tabsList = container.querySelector('[data-slot="tabs-list"]') as HTMLElement
      
      if (!tabsList) return
      
      const hasOverflow = tabsList.scrollWidth > container.clientWidth
      
      if (hasOverflow) {
        container.classList.add('tabs-overflow')
      } else {
        container.classList.remove('tabs-overflow')
      }
    }

    setTimeout(checkOverflow, 0)
    window.addEventListener('resize', checkOverflow)
    
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

export function OwnerPageClient({
  initialDocuments,
  initialTests,
  initialAssignments,
  initialUsers,
  userId,
  userName,
  userEmail,
  userImage
}: OwnerPageClientProps) {
  const { t } = useTranslation()
  const translateBadge = useBadgeTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Start with empty array and load from server immediately to avoid stale deleted documents
  const [documents, setDocuments] = useState<SavedDocument[]>([])
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
    if (tabFromUrl && ['overview', 'users', 'docs', 'tests', 'assignments', 'settings'].includes(tabFromUrl)) {
      return tabFromUrl
    }
    const previousTab = getPreviousTab('owner')
    if (previousTab && ['overview', 'users', 'docs', 'tests', 'assignments', 'settings'].includes(previousTab)) {
      return previousTab
    }
    return "overview"
  }, [searchParams])

  // Restore tab from sessionStorage on mount if not in URL
  useEffect(() => {
    const tabFromUrl = getTabFromUrl(searchParams)
    if (!tabFromUrl) {
      const previousTab = getPreviousTab('owner')
      if (previousTab && previousTab !== 'overview' && ['overview', 'users', 'docs', 'tests', 'assignments', 'settings'].includes(previousTab)) {
        router.replace(`/owner?tab=${previousTab}`, { scroll: false })
      }
    }
  }, [searchParams, router])

  // Save current tab when it changes
  useEffect(() => {
    if (defaultTab) {
      saveCurrentTab('owner', defaultTab)
    }
  }, [defaultTab])

  // Reload data when needed (for client-side updates)
  const loadData = useCallback(async (preserveDocuments = false) => {
    try {
      if (preserveDocuments) {
        setIsLoadingDocuments(true)
        setIsLoadingTests(true)
        setIsLoadingAssignments(true)
      }

      // Always use no-store cache to ensure fresh data (prevents showing deleted documents)
      const fetchOptions: RequestInit = { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
      const [usersResponse, assignmentsResponse, testsResponse, documentsResponse] = await Promise.all([
        fetch('/api/users', fetchOptions),
        fetch('/api/assignments', fetchOptions),
        fetch('/api/tests', fetchOptions),
        fetch(`/api/documents?t=${Date.now()}`, fetchOptions) // Add timestamp to bust cache
      ])

      const usersResult = await usersResponse.json()
      if (usersResult.success) {
        setSavedUsers((usersResult.data.users as SavedUser[]).filter(u => u.id !== userId))
      }

      // Handle assignments response - check if it's valid JSON
      if (assignmentsResponse.ok) {
        try {
          const assignmentsResult = await assignmentsResponse.json()
          if (assignmentsResult.success) {
            setSavedAssignments(assignmentsResult.data.assignments)
          }
          // Don't clear assignments on error - preserve existing data
        } catch (error) {
          console.error('Error parsing assignments response:', error)
          // Don't clear assignments on error - preserve existing data
        }
      } else {
        console.warn('Assignments API returned error:', assignmentsResponse.status)
        // Don't clear assignments on error - preserve existing data
      }

      // Handle tests response - check if it's valid JSON
      let testsResult
      if (testsResponse.ok) {
        try {
          testsResult = await testsResponse.json()
        } catch (error) {
          console.error('Error parsing tests response:', error)
          testsResult = { success: false }
        }
      } else {
        console.warn('Tests API returned error:', testsResponse.status)
        testsResult = { success: false }
      }
      
      if (testsResult.success) {
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
            const questionCount = Array.isArray(test.questionIds) ? test.questionIds.length : 0
            
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
              questions: [],
              sourceDocument,
              createdAt: test.createdAt,
              createdBy: test.createdBy
            }
          })
        )
        setSavedTests(transformedTests)
      }

      // Handle documents response - check if it's valid JSON
      let documentsResult
      if (documentsResponse.ok) {
        try {
          documentsResult = await documentsResponse.json()
        } catch (error) {
          console.error('Error parsing documents response:', error)
          documentsResult = { success: false }
        }
      } else {
        console.warn('Documents API returned error:', documentsResponse.status)
        documentsResult = { success: false }
      }
      
      if (documentsResult.success && documentsResult.data.documents && Array.isArray(documentsResult.data.documents)) {
        // Hard delete is used, so documents are permanently removed from DB
        // Filter out any documents that might have deletedAt set (safety check)
        const transformedDocs = documentsResult.data.documents
          .filter((doc: any) => !doc.deletedAt) // Safety filter (shouldn't be needed with hard delete)
          .map((doc: {
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
            size: doc.fileSize ? formatFileSize(doc.fileSize) : undefined,
            status: doc.status || 'ready',
            moduleId: doc.moduleId || null,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            parsedContent: doc.parsedContent || null
          }))
        
        setDocuments(transformedDocs)
        // Sync localStorage with database to remove any stale deleted documents
        if (typeof window !== 'undefined') {
          syncLocalStorageWithDatabase(transformedDocs)
        }
      }
      // Don't clear documents on error - preserve existing data
    } catch (error) {
      console.error('Error loading data:', error)
      // Don't clear data on error - preserve existing state
    } finally {
      setIsLoadingDocuments(false)
      setIsLoadingTests(false)
      setIsLoadingAssignments(false)
    }
  }, [userId])

  // Load documents from server on mount to ensure we have the latest data
  // This prevents showing deleted documents from initial server render
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Clear all document cache to ensure fresh data
      clearAllDocumentLocalStorage()
      
      // Clear browser cache for documents API
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            if (cacheName.includes('documents') || cacheName.includes('api')) {
              caches.delete(cacheName)
            }
          })
        })
      }
      
      // Immediately load documents from server (bypasses initial server-rendered list)
      loadData(false)
    }
  }, []) // Only run once on mount

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
      
      // Optimistically remove from UI for instant feedback
      setDocuments(docs => docs.filter(doc => doc.id !== id))
      
      const response = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      const result = await response.json()
      
      if (result.success) {
        toast.success('Document deleted successfully')
        // Refresh the list from server to ensure it's in sync (hard delete removes from DB immediately)
        setTimeout(() => loadData(false), 200)
      } else {
        // Document might have been already deleted (404) or other error
        if (response.status === 404) {
          toast.info('Document was already deleted')
        } else {
          toast.error(result.message || 'Failed to delete document')
        }
        // Always refresh list to sync with database
        loadData(false)
      }
    } catch (error) {
      // Refresh list on error (document might have been already deleted)
      loadData(false)
      console.error('Error deleting document:', error)
      // Check if it's a 404 (document already deleted)
      if (error instanceof Error && error.message.includes('404')) {
        toast.info('Document was already deleted')
      } else {
        toast.error('Error deleting document')
      }
    }
  }

  const handleViewDocument = (id: string, name?: string) => {
    const url = `/docs/${encodeURIComponent(id)}`
    router.prefetch(url)
    router.push(url)
  }

  const handleImportDocument = () => {
    router.push('/docs/import?returnTo=/owner?tab=docs')
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
    const url = `/test-builder?edit=${id}&returnTo=/owner?tab=tests`
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
    const url = `/assignment-builder?edit=${id}&returnTo=/owner?tab=assignments`
    router.prefetch(url)
    router.push(url)
  }

  const handleDeleteUser = async (id: string) => {
    try {
      const response = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      const result = await response.json()
      
      if (result.success) {
        setSavedUsers(prev => prev.filter(u => u.id !== id))
        toast.success('User deleted successfully')
      } else {
        toast.error(result.message || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Error deleting user')
    }
  }

  const handleViewUser = (id: string) => {
    console.log('View user:', id)
  }

  const handleEditUser = (id: string) => {
    router.push(`/user-builder?edit=${id}`)
  }

  // Memoize completion rate calculation
  const completionStats = useMemo(() => {
    let totalUserAssignments = 0
    let completedUserAssignments = 0
    
    savedAssignments.forEach(assignment => {
      if (assignment.users && Array.isArray(assignment.users)) {
        assignment.users.forEach((au) => {
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-background">
      <AppBar 
        role="owner" 
        user={{
          name: userName,
          email: userEmail,
          image: userImage
        }}
      />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8">
        <GreetingCard
          name={userName || t('owner')}
        />

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
                  <div className="text-2xl font-bold">{completionStats.percentage}%</div>
                  <p className="text-xs text-muted-foreground mt-2">{completionStats.label}</p>
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
                const document = documents.find(doc => {
                  if (doc.moduleId && a.moduleId) {
                    return String(doc.moduleId) === String(a.moduleId)
                  }
                  return false
                }) || documents.find(doc => String(doc.id) === String(a.moduleId))
                
                const test = a.testId ? savedTests.find(t => t.id === a.testId) : null
                
                const assignedUsers = (a.users || []).map(user => {
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

