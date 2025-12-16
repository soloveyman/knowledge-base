"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useMemo, useLayoutEffect, useCallback, Suspense, useTransition, useOptimistic, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppBar } from "@/components/common/app-bar"
import { EmptyState } from "@/components/common/empty-state"
import { GreetingCard } from "@/components/common/greeting-card"
import { useTranslation } from "@/lib/translation-context"
import { useBadgeTranslation } from "@/lib/badge-translations"
import { Badge } from "@/components/ui/badge"
import { useUsageLimits } from "@/lib/hooks/use-usage-limits"
import { toast } from "sonner"
import { 
  FileText,
  X,
  Sparkles,
  Loader2
} from "lucide-react"
import { DeleteConfirmation } from "@/components/common/delete-confirmation"
import dynamic from "next/dynamic"

import { SkeletonCard, SkeletonList } from "@/components/ui/skeleton"

// Lazy load heavy tab components to reduce initial bundle size
const UsersPage = dynamic(() => import("@/components/pages/users-page").then(mod => ({ default: mod.UsersPage })), {
  loading: () => (
    <div className="space-y-4 py-8">
      <SkeletonCard className="p-6" />
      <SkeletonList count={3} />
    </div>
  ),
  ssr: false
})
const TestsPage = dynamic(() => import("@/components/pages/tests-page").then(mod => ({ default: mod.TestsPage })), {
  loading: () => (
    <div className="space-y-4 py-8">
      <SkeletonCard className="p-6" />
      <SkeletonList count={3} />
    </div>
  ),
  ssr: false // Disable SSR for better performance on client-side only components
})
const AssignmentsPage = dynamic(() => import("@/components/pages/assignments-page").then(mod => ({ default: mod.AssignmentsPage })), {
  loading: () => (
    <div className="space-y-4 py-8">
      <SkeletonCard className="p-6" />
      <SkeletonList count={3} />
    </div>
  ),
  ssr: false
})
const UserProgressReport = dynamic(() => import("@/components/reports/user-progress-report"), {
  loading: () => <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div></div>,
  ssr: false
})
import { cleanupDocumentFromLocalStorage, syncLocalStorageWithDatabase, fixCorruptedLocalStorage } from "@/lib/localStorage-utils"

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
import { saveCurrentTab, getTabFromUrl, getPreviousTab } from "@/lib/redirect-utils"
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
    return tab && ['overview', 'users', 'docs', 'tests', 'assignments'].includes(tab) ? tab : "overview"
  }, [searchParams])

  // Restore tab from sessionStorage on mount if not in URL (only once on mount)
  useEffect(() => {
    const tabFromUrl = getTabFromUrl(searchParams)
    if (!tabFromUrl) {
      const previousTab = getPreviousTab('manager')
      if (previousTab && previousTab !== 'overview' && ['overview', 'users', 'docs', 'tests', 'assignments'].includes(previousTab)) {
        // Update URL to include the restored tab (only if not already in URL)
        router.replace(`/manager?tab=${previousTab}`, { scroll: false })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount to prevent refresh loops

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
  const loadData = useCallback(async (preserveData = false, forceRefresh = false) => {
    try {
      // Set loading states if we're refreshing (but don't show loading to avoid flicker)
      if (preserveData) {
        // Don't set loading states to true to avoid showing empty state
        // Data will be updated seamlessly
      }

      // Fetch all data in parallel for instant loading
      // Use cache-busting if forceRefresh is true (e.g., after test completion)
      // Otherwise use stale-while-revalidate for better UX
      const fetchOptions: RequestInit = forceRefresh
        ? { cache: 'no-store' } // Force fresh data when refreshing after test completion
        : { next: { revalidate: 30 } } // Revalidate every 30 seconds
      const [usersResponse, assignmentsResponse, testsResponse, documentsResponse] = await Promise.all([
        fetch('/api/users', fetchOptions),
        fetch('/api/assignments', fetchOptions),
        fetch('/api/tests', fetchOptions),
        fetch('/api/documents', fetchOptions)
      ])

      // Parse JSON in parallel after fetches complete for better performance
      const [usersResult, assignmentsResult, testsResult, documentsResult] = await Promise.all([
        usersResponse.json(),
        assignmentsResponse.json(),
        testsResponse.json(),
        documentsResponse.json()
      ])

      // Process users - managers should only work with employees
      if (usersResult.success) {
        const employees = (usersResult.data.users as Array<{
          id: string
          name: string
          job: string
          email: string
          role: string
          createdAt: string
          createdBy: string
          status: string
        }>).filter((u) => u.role === 'employee')
        setSavedUsers(employees)
      }

      // Process assignments
      if (assignmentsResult.success) {
        console.log('Manager: Loaded assignments from API:', assignmentsResult.data.assignments)
        setSavedAssignmentsWithLog(assignmentsResult.data.assignments)
      }

      // Process documents first (needed for test sourceDocument lookup)
      
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
        } else {
          console.log('Manager: No documents in API response')
          // NEVER clear documents if preserveData is true - this prevents empty state flicker
          // Only clear if preserveData is false AND we're not on docs tab AND documents array is empty
          if (!preserveData && defaultTab !== 'docs' && documents.length === 0) {
            setDocumentsWithLog([])
          } else {
            console.log('Manager: Keeping existing documents to avoid empty state flicker', {
              preserveData,
              defaultTab,
              documentsLength: documents.length
            })
          }
        }

      // Process tests (use document map instead of individual fetches)
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
      // NEVER clear documents if preserveData is true - this prevents empty state flicker
      // Only clear if preserveData is false AND documents array is empty
      if (!preserveData && documents.length === 0) {
        setDocumentsWithLog([])
      } else {
        console.log('Manager: Keeping existing documents after error to avoid empty state flicker')
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

  // Tab-specific loading functions - only load what's needed for each tab
  const loadTabData = useCallback(async (tab: string, preserveData = false, forceRefresh = false) => {
    // Prevent loading if already loading to avoid duplicate requests
    if ((tab === 'docs' && isLoadingDocuments) || 
        (tab === 'tests' && isLoadingTests) || 
        (tab === 'assignments' && isLoadingAssignments)) {
      return
    }
    
    try {
      if (tab === 'docs') {
        // First, check sessionStorage for pre-fetched data (faster than API call)
        if (typeof window !== 'undefined') {
          const pendingDocs = sessionStorage.getItem('pendingDocumentsRefresh')
          if (pendingDocs) {
            try {
              const { data, timestamp: storedTimestamp } = JSON.parse(pendingDocs)
              // Use if timestamp is recent (within last 30 seconds) - increased from 10s
              if (Date.now() - storedTimestamp < 30000 && data && Array.isArray(data)) {
                console.log('Manager: Using pre-fetched documents from sessionStorage, count:', data.length)
                const transformedDocs = data.map((doc: {
                  id: string
                  originalFileName?: string
                  title: string
                  fileType?: string
                  createdAt: string
                  updatedAt?: string
                  fileSize?: number
                  status?: string
                  parsedContent?: { metadata?: { enhancedBy?: string; enhancementTimestamp?: number } } | null
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
                setDocumentsWithLog(transformedDocs)
                syncLocalStorageWithDatabase(transformedDocs)
                sessionStorage.removeItem('pendingDocumentsRefresh')
                setIsLoadingDocuments(false)
                return // Skip API call since we have the data
              } else {
                // Data is stale, remove it
                sessionStorage.removeItem('pendingDocumentsRefresh')
              }
            } catch (error) {
              console.error('Failed to parse pending documents:', error)
              sessionStorage.removeItem('pendingDocumentsRefresh')
            }
          }
        }
        
        // Always show loading when fetching, but preserve existing data if preserveData is true
        setIsLoadingDocuments(true)
        try {
          // Use cache-busting if forceRefresh is true (e.g., returning from import)
          const fetchOptions: RequestInit = forceRefresh 
            ? { cache: 'no-store' as RequestCache }
            : { next: { revalidate: 30 } }
          
          const response = await fetch('/api/documents', fetchOptions)
          const result = await response.json()
          if (result.success && result.data.documents) {
            const transformedDocs = result.data.documents.map((doc: {
              id: string
              originalFileName?: string
              title: string
              fileType?: string
              createdAt: string
              updatedAt?: string
              fileSize?: number
              status?: string
              parsedContent?: { metadata?: { enhancedBy?: string; enhancementTimestamp?: number } } | null
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
            setDocumentsWithLog(transformedDocs)
            syncLocalStorageWithDatabase(transformedDocs)
          }
        } finally {
          setIsLoadingDocuments(false)
        }
      } else if (tab === 'tests') {
        // Always show loading when fetching, but preserve existing data if preserveData is true
        setIsLoadingTests(true)
        try {
          // Tests need documents for sourceDocument lookup
          // Use cache-busting if forceRefresh is true (e.g., returning from test-builder)
          const fetchOpts: RequestInit = forceRefresh 
            ? { cache: 'no-store' as RequestCache }
            : { next: { revalidate: 30 } }
          
          const [testsResponse, documentsResponse] = await Promise.all([
            fetch('/api/tests', fetchOpts),
            fetch('/api/documents', fetchOpts)
          ])
          
          // Parse JSON in parallel
          const [documentsResult, testsResult] = await Promise.all([
            documentsResponse.json(),
            testsResponse.json()
          ])
          
          const documentMap = new Map<string, { originalFileName?: string; title?: string }>()
          if (documentsResult.success && documentsResult.data.documents) {
            documentsResult.data.documents.forEach((doc: { id: string; originalFileName?: string; title: string }) => {
              documentMap.set(doc.id, { originalFileName: doc.originalFileName, title: doc.title })
            })
          }
          if (testsResult.success) {
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
                questions: [],
                sourceDocument,
                createdAt: test.createdAt,
                createdBy: test.createdBy
              }
            })
            setSavedTestsWithLog(transformedTests)
          } else {
            // If API failed, set empty array to show empty state
            setSavedTestsWithLog([])
          }
        } finally {
          setIsLoadingTests(false)
        }
      } else if (tab === 'assignments') {
        setIsLoadingAssignments(!preserveData)
        try {
          // Assignments need all data for mapping
          // Use forceRefresh to ensure fresh data when returning from assignment-builder
          await loadData(preserveData, forceRefresh)
        } finally {
          setIsLoadingAssignments(false)
        }
      } else if (tab === 'overview') {
        // Overview needs all data
        await loadData(preserveData)
      } else if (tab === 'users') {
        // Reload only users for Users tab
        const hasTimestamp = searchParams.has('_t')
        const fetchOptions: RequestInit = hasTimestamp
          ? { cache: 'no-store' }
          : { next: { revalidate: 30 } }

        const response = await fetch('/api/users', fetchOptions)
        const result = await response.json()
        if (result.success) {
          const employees = (result.data.users as Array<{
            id: string
            name: string
            job: string
            email: string
            role: string
            createdAt: string
            createdBy: string
            status: string
          }>).filter((u) => u.role === 'employee')
          setSavedUsers(employees)
        }
      }
    } catch (error) {
      console.error(`Error loading ${tab} tab data:`, error)
      // Ensure loading states are cleared on error
      if (tab === 'docs') {
        setIsLoadingDocuments(false)
      } else if (tab === 'tests') {
        setIsLoadingTests(false)
      } else if (tab === 'assignments') {
        setIsLoadingAssignments(false)
      }
    }
  }, [loadData, isLoadingDocuments, isLoadingTests, isLoadingAssignments, setDocumentsWithLog, setSavedTestsWithLog])

  // Track last loaded tab and loading state to prevent duplicate loads
  const lastLoadedTabRef = useRef<string | null>(null)
  const isLoadingRef = useRef<boolean>(false)
  
  // Always reload data when tab changes to ensure fresh data
  // This ensures fresh data after returning from import/edit pages
  useEffect(() => {
    // Skip if already loading
    if (isLoadingRef.current) {
      return
    }
    
    // Always load on first mount or if tab hasn't been loaded yet
    if (lastLoadedTabRef.current === null || lastLoadedTabRef.current !== defaultTab) {
      isLoadingRef.current = true
      lastLoadedTabRef.current = defaultTab
      
      const loadTab = async () => {
        try {
          if (defaultTab === 'docs') {
            console.log('Manager: Docs tab activated, loading documents...')
            await loadTabData('docs', true, false)
          } else if (defaultTab === 'tests') {
            console.log('Manager: Tests tab activated, loading tests...')
            await loadTabData('tests', true, false)
          } else if (defaultTab === 'assignments') {
            console.log('Manager: Assignments tab activated, loading assignments...')
            await loadTabData('assignments', true, false)
          } else if (defaultTab === 'overview') {
            console.log('Manager: Overview tab activated, loading data...')
            await loadTabData('overview', true, false)
          } else if (defaultTab === 'users') {
            console.log('Manager: Users tab activated, loading users...')
            await loadTabData('users', true, false)
          }
        } finally {
          isLoadingRef.current = false
        }
      }
      
      loadTab()
      return
    }
    
    // If tab was already loaded, check if we have data
    // If no data, reload even if tab was loaded before
    const hasData = defaultTab === 'docs' ? documents.length > 0 :
                   defaultTab === 'tests' ? savedTests.length > 0 :
                   defaultTab === 'assignments' ? savedAssignments.length > 0 :
                   defaultTab === 'users' ? savedUsers.length > 0 : true
    
    if (!hasData) {
      console.log(`Manager: ${defaultTab} tab has no data, reloading...`)
      isLoadingRef.current = true
      
      const loadTab = async () => {
        try {
          if (defaultTab === 'docs') {
            await loadTabData('docs', true, false)
          } else if (defaultTab === 'tests') {
            await loadTabData('tests', true, false)
          } else if (defaultTab === 'assignments') {
            await loadTabData('assignments', true, false)
          } else if (defaultTab === 'overview') {
            await loadTabData('overview', true, false)
          } else if (defaultTab === 'users') {
            await loadTabData('users', true, false)
          }
        } finally {
          isLoadingRef.current = false
        }
      }
      
      loadTab()
    }
  }, [defaultTab, loadTabData]) // Removed length dependencies to prevent constant reloads

  // Track if we've already processed the timestamp to prevent duplicate calls
  const processedTimestampRef = useRef<string | null>(null)
  
  // Reload data when returning from edit/create pages (detected via URL parameters)
  useEffect(() => {
    const checkAndReload = () => {
      // Check window.location.search first for immediate detection (works before searchParams updates)
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : searchParams
      const tab = urlParams.get('tab') || getTabFromUrl(searchParams) || defaultTab
      const timestamp = urlParams.get('_t') || searchParams.get('_t')
      const hasTimestamp = !!timestamp
      
      // If we have a timestamp parameter, it means we're returning from a create/edit page
      // Force reload the appropriate tab to show newly saved/updated data
      // Only reload if tab actually changed and we haven't loaded it yet, OR if we have a new timestamp
      const hasNewTimestamp = hasTimestamp && tab && timestamp !== processedTimestampRef.current
      const tabChanged = tab && tab !== lastLoadedTabRef.current && !isLoadingRef.current
      const shouldReload = hasNewTimestamp || tabChanged
      
      if (shouldReload) {
        if (hasTimestamp && timestamp !== processedTimestampRef.current) {
          console.log(`Manager: Detected return from edit/create, reloading ${tab} tab...`)
          // Mark this timestamp as processed to prevent duplicate calls
          processedTimestampRef.current = timestamp
          
          // Force reload the tab data (don't skip even if we have sessionStorage data)
          // This ensures fresh data is always loaded after import
          isLoadingRef.current = true
          
          const forceReloadTab = async () => {
            try {
              if (tab === 'docs') {
                // First, try sessionStorage for immediate display
                if (typeof window !== 'undefined') {
                  const pendingDocs = sessionStorage.getItem('pendingDocumentsRefresh')
                  if (pendingDocs) {
                    try {
                      const { data, timestamp: storedTimestamp } = JSON.parse(pendingDocs)
                      // Only use if timestamp is recent (within last 30 seconds)
                      if (Date.now() - storedTimestamp < 30000 && data && Array.isArray(data)) {
                        console.log('Manager: Using pre-fetched documents from sessionStorage, count:', data.length)
                        const transformedDocs = data.map((doc: {
                          id: string
                          originalFileName?: string
                          title: string
                          fileType?: string
                          createdAt: string
                          updatedAt?: string
                          fileSize?: number
                          status?: string
                          parsedContent?: { metadata?: { enhancedBy?: string; enhancementTimestamp?: number } } | null
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
                        setDocumentsWithLog(transformedDocs)
                        syncLocalStorageWithDatabase(transformedDocs)
                        sessionStorage.removeItem('pendingDocumentsRefresh')
                        lastLoadedTabRef.current = tab
                        isLoadingRef.current = false
                        return // Skip API call since we have the data
                      }
                    } catch (error) {
                      console.error('Failed to parse pending documents:', error)
                    }
                  }
                }
                // If no sessionStorage data or it's stale, load from API
                console.log('Manager: Loading documents from API after import...')
                await loadTabData('docs', true, true) // forceRefresh = true
                lastLoadedTabRef.current = tab
              } else if (tab === 'tests') {
                // First, try sessionStorage for immediate display
                if (typeof window !== 'undefined') {
                  const pendingTests = sessionStorage.getItem('pendingTestsRefresh')
                  if (pendingTests) {
                    try {
                      const { tests, documents, timestamp: storedTimestamp, editedTestId } = JSON.parse(pendingTests)
                      // Only use if timestamp is recent (within last 30 seconds)
                      if (Date.now() - storedTimestamp < 30000 && tests && documents) {
                        console.log('Manager: Using pre-fetched tests from sessionStorage')
                    const documentMap = new Map<string, { originalFileName?: string; title?: string }>()
                    documents.forEach((doc: { id: string; originalFileName?: string; title: string }) => {
                      documentMap.set(doc.id, { originalFileName: doc.originalFileName, title: doc.title })
                    })
                    const transformedTests = (tests as Array<{
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
                        questions: [],
                        sourceDocument,
                        createdAt: test.createdAt,
                        createdBy: test.createdBy
                      }
                    })
                    
                    // If this is an edit operation, preserve the order by updating only the edited test
                    if (editedTestId && savedTests.length > 0) {
                      // Find the updated test in the new data
                      const updatedTest = transformedTests.find(t => t.id === editedTestId)
                      if (updatedTest) {
                        // Update only the edited test in the existing list, preserving order
                        setSavedTests(prevTests => {
                          const testIndex = prevTests.findIndex(t => t.id === editedTestId)
                          if (testIndex !== -1) {
                            // Update the test at its original position
                            const newTests = [...prevTests]
                            newTests[testIndex] = updatedTest
                            // Also update localStorage
                            if (typeof window !== 'undefined') {
                              try {
                                localStorage.setItem('manager-tests', JSON.stringify(newTests))
                              } catch (error) {
                                console.error('Error saving tests to localStorage:', error)
                              }
                            }
                            return newTests
                          }
                          // If not found, fall back to full replacement
                          return transformedTests
                        })
                      } else {
                        // Updated test not found, use full replacement
                        setSavedTestsWithLog(transformedTests)
                      }
                    } else {
                      // New test or no existing tests, use full replacement
                      setSavedTestsWithLog(transformedTests)
                    }
                    
                    sessionStorage.removeItem('pendingTestsRefresh')
                    lastLoadedTabRef.current = tab
                    isLoadingRef.current = false
                    return // Skip API call since we have the data
                  }
                } catch (error) {
                  console.error('Failed to parse pending tests:', error)
                }
                  }
                }
              // If no sessionStorage data or it's stale, load from API
              await loadTabData('tests', true, true) // forceRefresh = true
              lastLoadedTabRef.current = tab
            } else if (tab === 'assignments') {
              // First, try sessionStorage for immediate display
              if (typeof window !== 'undefined') {
                const pendingAssignments = sessionStorage.getItem('pendingAssignmentsRefresh')
                if (pendingAssignments) {
                  try {
                    const { data, timestamp: storedTimestamp } = JSON.parse(pendingAssignments)
                    // Only use if timestamp is recent (within last 10 seconds)
                    if (Date.now() - storedTimestamp < 10000 && data && Array.isArray(data)) {
                      console.log('Manager: Using pre-fetched assignments from sessionStorage, count:', data.length)
                      setSavedAssignmentsWithLog(data)
                      sessionStorage.removeItem('pendingAssignmentsRefresh')
                      lastLoadedTabRef.current = tab
                      return // Skip API call since we have the data
                    } else {
                      console.log('Manager: Pending assignments data invalid or expired:', { 
                        hasData: !!data, 
                        isArray: Array.isArray(data),
                        age: Date.now() - storedTimestamp 
                      })
                    }
                  } catch (error) {
                    console.error('Failed to parse pending assignments:', error)
                  }
                } else {
                  console.log('Manager: No pending assignments found in sessionStorage')
                }
              }
              // If no sessionStorage data or it's stale, load from API
              await loadTabData('assignments', true, true) // forceRefresh = true
              lastLoadedTabRef.current = tab
            } else if (tab === 'users') {
              // Reload users tab
              await loadTabData('users', true, true) // forceRefresh = true
              lastLoadedTabRef.current = tab
            }
          } catch (error) {
            console.error('Error in forceReloadTab:', error)
          } finally {
            isLoadingRef.current = false
          }
          }
          
          // Execute the force reload
          forceReloadTab()
        } else {
          // Only reload if tab actually changed and we haven't loaded it yet
          if (tab && tab !== lastLoadedTabRef.current && !isLoadingRef.current) {
            console.log(`Manager: Tab changed to ${tab}, loading data...`)
            isLoadingRef.current = true
            
            // Use stale-while-revalidate for better UX (same as other tabs)
            if (tab === 'docs') {
              // Only show loading if we don't have cached data
              if (documents.length === 0) {
                setIsLoadingDocuments(true)
              }
              
              // Direct fetch for documents with stale-while-revalidate
              fetch('/api/documents', { next: { revalidate: 30 } })
                .then(res => res.json())
                .then(result => {
                  if (result.success && result.data.documents) {
                    const transformedDocs = result.data.documents.map((doc: {
                      id: string
                      originalFileName?: string
                      title: string
                      fileType?: string
                      createdAt: string
                      updatedAt?: string
                      fileSize?: number
                      status?: string
                      parsedContent?: { metadata?: { enhancedBy?: string; enhancementTimestamp?: number } } | null
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
                    setDocumentsWithLog(transformedDocs)
                    syncLocalStorageWithDatabase(transformedDocs)
                    lastLoadedTabRef.current = tab
                  }
                  setIsLoadingDocuments(false)
                  isLoadingRef.current = false
                })
                .catch((error) => {
                  console.error('Error loading documents:', error)
                  setIsLoadingDocuments(false)
                  isLoadingRef.current = false
                })
            } else if (tab === 'tests') {
              // Direct fetch for tests with stale-while-revalidate - fetch tests and documents in parallel
              Promise.all([
                fetch('/api/tests', { next: { revalidate: 30 } }),
                fetch('/api/documents', { next: { revalidate: 30 } })
              ])
                .then(async ([testsResponse, documentsResponse]) => {
                  const [testsResult, documentsResult] = await Promise.all([
                    testsResponse.json(),
                    documentsResponse.json()
                  ])
                  
                  // Build document map for sourceDocument lookup
                  const documentMap = new Map<string, { originalFileName?: string; title?: string }>()
                  if (documentsResult.success && documentsResult.data.documents) {
                    documentsResult.data.documents.forEach((doc: { id: string; originalFileName?: string; title: string }) => {
                      documentMap.set(doc.id, { originalFileName: doc.originalFileName, title: doc.title })
                    })
                  }
                  
                  if (testsResult.success) {
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
                        questions: [],
                        sourceDocument,
                        createdAt: test.createdAt,
                        createdBy: test.createdBy
                      }
                    })
                    setSavedTestsWithLog(transformedTests)
                    lastLoadedTabRef.current = tab
                  }
                })
                .catch(console.error)
            } else if (tab === 'assignments') {
            // Check sessionStorage first for pre-fetched data (after edit/create)
            const pendingAssignments = sessionStorage.getItem('pendingAssignmentsRefresh')
            if (pendingAssignments) {
              try {
                const { data, timestamp: storedTimestamp, editedAssignmentId } = JSON.parse(pendingAssignments)
                // Only use if timestamp is recent (within last 10 seconds)
                if (Date.now() - storedTimestamp < 10000 && data && Array.isArray(data)) {
                  console.log('Manager: Using pre-fetched assignments from sessionStorage, count:', data.length)
                  
                  // If this is an edit operation, preserve the order by updating only the edited assignment
                  if (editedAssignmentId && savedAssignments.length > 0) {
                    // Find the updated assignment in the new data
                    const updatedAssignment = data.find((a: SavedAssignment) => a.id === editedAssignmentId)
                    if (updatedAssignment) {
                      // Update only the edited assignment in the existing list, preserving order
                      setSavedAssignments(prevAssignments => {
                        const assignmentIndex = prevAssignments.findIndex(a => a.id === editedAssignmentId)
                        if (assignmentIndex !== -1) {
                          // Update the assignment at its original position
                          const newAssignments = [...prevAssignments]
                          newAssignments[assignmentIndex] = updatedAssignment
                          // Also update localStorage
                          if (typeof window !== 'undefined') {
                            try {
                              localStorage.setItem('manager-assignments', JSON.stringify(newAssignments))
                            } catch (error) {
                              console.error('Error saving assignments to localStorage:', error)
                            }
                          }
                          return newAssignments
                        }
                        // If not found, fall back to full replacement
                        return data
                      })
                    } else {
                      // Updated assignment not found, use full replacement
                      setSavedAssignmentsWithLog(data)
                    }
                  } else {
                    // New assignment or no existing assignments, use full replacement
                    setSavedAssignmentsWithLog(data)
                  }
                  
                  sessionStorage.removeItem('pendingAssignmentsRefresh')
                  lastLoadedTabRef.current = tab
                  return // Skip API call since we have the data
                } else {
                  sessionStorage.removeItem('pendingAssignmentsRefresh') // Clean up expired data
                }
              } catch (error) {
                console.error('Failed to parse pending assignments:', error)
                sessionStorage.removeItem('pendingAssignmentsRefresh') // Clean up corrupted data
              }
            }
            
            // Direct fetch for assignments with cache-busting
            fetch('/api/assignments', { cache: 'no-store' })
              .then(res => res.json())
              .then(result => {
                if (result.success) {
                  console.log('Manager: Loaded assignments from API:', result.data.assignments)
                  setSavedAssignmentsWithLog(result.data.assignments)
                  lastLoadedTabRef.current = tab
                }
              })
              .catch(console.error)
          } else {
            // For other tabs (overview), use loadTabData with forceRefresh=true
            loadTabData(tab, true, true) // Use preserveData=true to avoid flickering, forceRefresh=true for fresh data
            lastLoadedTabRef.current = tab
          }
        }
      }
    }
    } // Close checkAndReload function
    
    // Check immediately on mount and when searchParams change
    checkAndReload()
    
    // Also listen for navigation events to catch immediate changes
    if (typeof window !== 'undefined') {
      const handlePopState = () => {
        // Immediate check without delay for faster updates
        // Use a small delay to ensure URL has updated
        setTimeout(checkAndReload, 50)
      }
      
      // Listen for both popstate and custom navigation events
      window.addEventListener('popstate', handlePopState)
      window.addEventListener('locationchange', handlePopState)
      
      // Also check periodically when we have a timestamp (fallback for mobile)
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : searchParams
      let intervalId: NodeJS.Timeout | null = null
      if (urlParams.has('_t') || searchParams.has('_t')) {
        // Check every 100ms for up to 2 seconds to catch URL updates
        let checks = 0
        intervalId = setInterval(() => {
          checks++
          if (checks > 20) {
            if (intervalId) clearInterval(intervalId)
            return
          }
          checkAndReload()
        }, 100)
      }
      
      // Return cleanup function for useEffect
      return () => {
        window.removeEventListener('popstate', handlePopState)
        window.removeEventListener('locationchange', handlePopState)
        if (intervalId) {
          clearInterval(intervalId)
        }
      }
    }
    
    // Return empty cleanup if window is undefined
    return () => {}
  }, [searchParams, loadTabData, defaultTab])

  // Reload data when page becomes visible (e.g., when returning from document viewer or test page)
  // Only reload if we've been away for more than 30 seconds to avoid unnecessary refreshes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && defaultTab && ['docs', 'tests', 'assignments', 'overview', 'users'].includes(defaultTab)) {
        const lastFocusTime = sessionStorage.getItem('managerLastFocusTime')
        const now = Date.now()
        // Only reload if away for more than 30 seconds
        if (!lastFocusTime || (now - parseInt(lastFocusTime)) > 30000) {
          console.log(`Manager: Page became visible after ${now - (lastFocusTime ? parseInt(lastFocusTime) : 0)}ms, reloading ${defaultTab} tab...`)
          // Use requestIdleCallback to avoid blocking UI
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
              if (defaultTab === 'overview') {
                loadData(true, true).catch(console.error)
              } else {
                loadTabData(defaultTab, true, false).catch(console.error)
              }
            })
          } else {
            setTimeout(() => {
              if (defaultTab === 'overview') {
                loadData(true, true).catch(console.error)
              } else {
                loadTabData(defaultTab, true, false).catch(console.error)
              }
            }, 100)
          }
          sessionStorage.setItem('managerLastFocusTime', now.toString())
        }
      }
    }

    const handleFocus = () => {
      if (defaultTab && ['docs', 'tests', 'assignments', 'overview', 'users'].includes(defaultTab)) {
        const lastFocusTime = sessionStorage.getItem('managerLastFocusTime')
        const now = Date.now()
        // Only reload if away for more than 30 seconds
        if (!lastFocusTime || (now - parseInt(lastFocusTime)) > 30000) {
          console.log(`Manager: Window focused after ${now - (lastFocusTime ? parseInt(lastFocusTime) : 0)}ms, reloading ${defaultTab} tab...`)
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
              if (defaultTab === 'overview') {
                loadData(true, true).catch(console.error)
              } else {
                loadTabData(defaultTab, true, false).catch(console.error)
              }
            })
          } else {
            setTimeout(() => {
              if (defaultTab === 'overview') {
                loadData(true, true).catch(console.error)
              } else {
                loadTabData(defaultTab, true, false).catch(console.error)
              }
            }, 100)
          }
          sessionStorage.setItem('managerLastFocusTime', now.toString())
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [defaultTab, loadTabData, loadData])


  // Document handlers with optimistic updates
  const [enhancingDocId, setEnhancingDocId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const { limits } = useUsageLimits()
  const isEnhancementDisabled = limits?.enhancements.expired ?? false
  
  // Optimistic state for documents
  const [optimisticDocuments, addOptimisticDocument] = useOptimistic(
    documents,
    (state, { action, id, document }: { action: 'delete' | 'enhance'; id: string; document?: typeof documents[0] }) => {
      if (action === 'delete') {
        return state.filter(doc => doc.id !== id)
      }
      if (action === 'enhance' && document) {
        return state.map(doc => doc.id === id ? document : doc)
      }
      return state
    }
  )

  const handleEnhanceDocument = async (id: string) => {
    if (isEnhancementDisabled) {
      toast.error(
        t('enhancementLimitReached').replace('{current}', String(limits?.enhancements.current || 0)).replace('{max}', String(limits?.enhancements.max || 0)),
        { duration: 5000 }
      )
      return
    }

    try {
      setEnhancingDocId(id)
      toast.loading(t('enhancingDocument'), { id: 'enhance' })
      
      const response = await fetch(`/api/documents/${id}/enhance`, {
        method: 'POST',
        cache: 'no-store'
      })
      const result = await response.json()
      
      startTransition(() => {
        if (result.success) {
          toast.success(t('documentEnhancedSuccessfully'), { id: 'enhance' })
          // Reload documents to show updated content
          loadData(false)
        } else {
          console.error('Failed to enhance document:', result.message)
          toast.error(result.message || t('failedToEnhanceDocument'), { id: 'enhance' })
        }
      })
    } catch (error) {
      console.error('Error enhancing document:', error)
      toast.error(t('errorEnhancingDocument'), { id: 'enhance' })
    } finally {
      setEnhancingDocId(null)
    }
  }

  // Track documents being deleted to prevent duplicate requests
  const deletingDocumentsRef = useRef<Set<string>>(new Set())
  
  const handleDeleteDocument = async (id: string) => {
    // Prevent duplicate delete requests
    if (deletingDocumentsRef.current.has(id)) {
      console.log(`Document ${id} is already being deleted, skipping duplicate request`)
      return
    }
    
    deletingDocumentsRef.current.add(id)
    
    // Optimistically remove from state immediately for instant UI update
    const previousDocuments = documents
    startTransition(() => {
      addOptimisticDocument({ action: 'delete', id })
      setDocumentsWithLog(documents.filter(doc => doc.id !== id))
      cleanupDocumentFromLocalStorage(id)
    })
    
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        cache: 'no-store'
      })
      
      // Check response status before parsing JSON
      if (!response.ok) {
        // 404 means document already deleted - treat as success (idempotent)
        if (response.status === 404) {
          console.log(`Document ${id} already deleted (404), treating as success`)
          toast.success(t('documentDeletedSuccessfully'))
          deletingDocumentsRef.current.delete(id)
          return
        }
        
        let errorMessage = t('failedToDeleteDocument')
        try {
          const errorResult = await response.json()
          errorMessage = errorResult.message || errorMessage
        } catch {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage
        }
        
        // Revert on error - restore previous state
        startTransition(() => {
          setDocumentsWithLog(previousDocuments)
        })
        console.error('Failed to delete document:', errorMessage)
        toast.error(errorMessage || t('failedToDeleteDocument'))
        deletingDocumentsRef.current.delete(id)
        return
      }
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(t('documentDeletedSuccessfully'))
        // No need to reload - state already updated
      } else {
        // Revert on error - restore previous state
        startTransition(() => {
          setDocumentsWithLog(previousDocuments)
        })
        console.error('Failed to delete document:', result.message)
        toast.error(result.message || t('failedToDeleteDocument'))
      }
    } catch (error) {
      // Revert on error - restore previous state
      startTransition(() => {
        setDocumentsWithLog(previousDocuments)
      })
      const errorMessage = error instanceof Error ? error.message : t('errorDeletingDocument')
      console.error('Error deleting document:', error)
      toast.error(errorMessage || t('errorDeletingDocument'))
    } finally {
      deletingDocumentsRef.current.delete(id)
    }
  }

  const handleViewDocument = (id: string, name?: string) => {
    console.log('📄 Manager: handleViewDocument called')
    console.log('📄 ID:', id, 'ID type:', typeof id, 'Name:', name)
    // Use ID for navigation - more reliable than name
    const encodedId = encodeURIComponent(String(id))
    // Preserve current URL with tab for return navigation
    const currentUrl = window.location.pathname + window.location.search
    const url = `/docs/${encodedId}?returnTo=${encodeURIComponent(currentUrl)}`
    console.log('📄 Navigating to:', url)
    // Prefetch for instant navigation (non-blocking)
    router.prefetch(url)
    startTransition(() => {
      router.push(url)
    })
  }

  // Prefetch common routes on hover for better UX
  const handleDocumentHover = useCallback((id: string) => {
    const url = `/docs/${encodeURIComponent(String(id))}`
    router.prefetch(url)
  }, [router])

  const handleTestHover = useCallback((id: string) => {
    const url = `/test-builder?edit=${id}&returnTo=/manager?tab=tests`
    router.prefetch(url)
  }, [router])

  const handleAssignmentHover = useCallback((id: string) => {
    const url = `/assignment-builder?edit=${id}&returnTo=/manager?tab=assignments`
    router.prefetch(url)
  }, [router])

  const handleImportDocument = () => {
    router.push('/docs/import?returnTo=/manager?tab=docs')
  }

  // Test handlers
  const handleDeleteTest = async (id: string) => {
    // Optimistically remove from state immediately for instant UI update
    const previousTests = savedTests
    setSavedTestsWithLog(savedTests.filter(test => test.id !== id))
    
    try {
      const response = await fetch(`/api/tests/${id}`, {
        method: 'DELETE',
        cache: 'no-store'
      })
      const result = await response.json()
      
      if (result.success) {
        toast.success(t('testDeletedSuccessfully'))
        // No need to reload - state already updated
      } else {
        // Revert on error - restore previous state
        setSavedTestsWithLog(previousTests)
        console.error('Failed to delete test:', result.message)
        toast.error(result.message || t('failedToDeleteTest'))
      }
    } catch (error) {
      // Revert on error - restore previous state
      setSavedTestsWithLog(previousTests)
      console.error('Error deleting test:', error)
      toast.error(t('errorDeletingTest'))
    }
  }

  const handleViewTest = (id: string) => {
    console.log('Open test:', id)
  }

  const handleEditTest = (id: string) => {
    // Redirect to test builder with edit parameter and returnTo
    const url = `/test-builder?edit=${id}&returnTo=/manager?tab=tests`
    router.prefetch(url)
    startTransition(() => {
      router.push(url)
    })
  }

  // Assignment handlers
  const handleDeleteAssignment = async (id: string) => {
    // Optimistically remove from state immediately for instant UI update
    const previousAssignments = savedAssignments
    setSavedAssignmentsWithLog(savedAssignments.filter(a => a.id !== id))
    
    try {
      const response = await fetch(`/api/assignments/${id}`, {
        method: 'DELETE',
        cache: 'no-store'
      })
      const result = await response.json()
      
      if (result.success) {
        toast.success(t('assignmentDeletedSuccessfully'))
        // No need to reload - state already updated
      } else {
        // Revert on error - restore previous state
        setSavedAssignmentsWithLog(previousAssignments)
        console.error('Failed to delete assignment:', result.message)
        toast.error(result.message || t('failedToDeleteAssignment'))
      }
    } catch (error) {
      // Revert on error - restore previous state
      setSavedAssignmentsWithLog(previousAssignments)
      console.error('Error deleting assignment:', error)
      toast.error(t('errorDeletingAssignment'))
    }
  }

  const handleViewAssignment = (id: string) => {
    console.log('Open assignment:', id)
  }

  const handleEditAssignment = (id: string) => {
    // Redirect to assignment builder with edit parameter
    const url = `/assignment-builder?edit=${id}&returnTo=/manager?tab=assignments`
    router.prefetch(url)
    startTransition(() => {
      router.push(url)
    })
  }

  const handleResetAssignment = async (id: string) => {
    try {
      const response = await fetch(`/api/assignments/${id}/reset`, {
        method: 'POST',
        cache: 'no-store'
      })
      const result = await response.json()
      
      if (result.success) {
        toast.success(t('assignmentResultsResetSuccessfully'))
        // Reload assignments to reflect the reset
        loadData(true, true).catch(console.error)
      } else {
        console.error('Failed to reset assignment:', result.message)
        toast.error(result.message || t('failedToResetAssignmentResults'))
      }
    } catch (error) {
      console.error('Error resetting assignment:', error)
      toast.error(t('errorResettingAssignmentResults'))
    }
  }

  // Note: Next.js loading.tsx will handle the initial loading state
  if (status === "loading" || !session) {
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
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8">
        <GreetingCard
          name={session.user?.name || t('manager')}
        />


        {/* Main Tabs */}
        <Tabs value={defaultTab} onValueChange={(value) => {
          if (value && ['overview', 'users', 'docs', 'tests', 'assignments'].includes(value)) {
            // Only update if tab actually changed to prevent unnecessary router calls
            if (value !== defaultTab) {
              router.replace(`/manager?tab=${value}`, { scroll: false })
              saveCurrentTab('manager', value)
              // Reset last loaded tab ref to allow reload when switching tabs
              lastLoadedTabRef.current = null
            }
          }
        }} className="space-y-3 md:space-y-6">
          <div className="tabs-scroll-container">
            <TabsList className="grid w-full min-w-max grid-cols-5">
            <TabsTrigger 
              value="overview"
              onMouseEnter={() => router.prefetch('/manager?tab=overview')}
            >
              {t('overview')}
            </TabsTrigger>
            <TabsTrigger 
              value="users"
              onMouseEnter={() => router.prefetch('/manager?tab=users')}
            >
              {t('users')}
            </TabsTrigger>
            <TabsTrigger 
              value="docs"
              onMouseEnter={() => router.prefetch('/manager?tab=docs')}
            >
              {t('documents')}
            </TabsTrigger>
            <TabsTrigger 
              value="tests"
              onMouseEnter={() => router.prefetch('/manager?tab=tests')}
            >
              {t('tests')}
            </TabsTrigger>
            <TabsTrigger 
              value="assignments"
              onMouseEnter={() => router.prefetch('/manager?tab=assignments')}
            >
              {t('assignments')}
            </TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-3 md:space-y-6">
            {/* Overview Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('totalEmployees')}</CardTitle>
                  <span className="text-2xl">👥</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{savedUsers.length}</div>
                  <p className="text-xs text-muted-foreground">{t('teamMembersInSystem')}</p>
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
              users={savedUsers.filter(u => u.role === 'employee')} 
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

          <TabsContent value="users" className="space-y-3 md:space-y-6">
            <UsersPage
              users={savedUsers}
              onDeleteUser={async (id: string) => {
                const previousUsers = savedUsers
                setSavedUsers(savedUsers.filter(u => u.id !== id))

                try {
                  const response = await fetch(`/api/users/${id}`, {
                    method: 'DELETE',
                    cache: 'no-store'
                  })
                  const result = await response.json()

                  if (!result.success) {
                    setSavedUsers(previousUsers)
                    console.error('Manager: Failed to delete user:', result.message)
                    toast.error(result.message || t('failedToDeleteUser'))
                  } else {
                    toast.success(t('userDeletedSuccessfully'))
                  }
                } catch (error) {
                  setSavedUsers(previousUsers)
                  console.error('Manager: Error deleting user:', error)
                  toast.error(t('errorDeletingUser'))
                }
              }}
              onViewUser={(id: string) => {
                console.log('Manager: View user', id)
              }}
              onEditUser={(id: string) => {
                const url = `/user-builder?edit=${id}&returnTo=/manager?tab=users`
                router.prefetch(url)
                startTransition(() => {
                  router.push(url)
                })
              }}
              hideEmptyState={(() => {
                const hasTimestamp = searchParams.has('_t')
                const tab = getTabFromUrl(searchParams)
                return hasTimestamp && tab === 'users'
              })()}
              isManagerView
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
                {(() => {
                  // Check if we're returning from import (has timestamp parameter)
                  const hasTimestamp = searchParams.has('_t')
                  const tab = getTabFromUrl(searchParams)
                  const isReturningFromImport = hasTimestamp && tab === 'docs'
                  
                  // Only show loading if we have no cached data AND are actually loading
                  // This prevents flicker when we have cached data from localStorage
                  if (isLoadingDocuments && documents.length === 0) {
                    return (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
                        <span className="ml-3 text-muted-foreground">{t('refreshingDocuments')}</span>
                      </div>
                    )
                  }
                  
                  // Show empty state if no documents (regardless of returning from import)
                  // hideEmptyState only prevents flicker during loading, not after loading completes
                  if (documents.length === 0) {
                    return (
                      <EmptyState
                        icon={<span className="text-5xl">📄</span>}
                        title={t('noDocumentsUploaded')}
                        description={t('getStartedImportDocument')}
                        actionLabel={t('importDocument')}
                        onAction={handleImportDocument}
                      />
                    )
                  }
                  
                  // Show documents
                  return (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div 
                        key={doc.id}
                        className="flex items-center justify-between p-4 border border-border rounded-3xl hover:bg-accent cursor-pointer gap-3"
                        onClick={() => handleViewDocument(doc.id, doc.name)}
                        onMouseEnter={() => handleDocumentHover(doc.id)}
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
                            <div
                              onClick={(e) => {
                                if (isEnhancementDisabled && enhancingDocId !== doc.id) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleEnhanceDocument(doc.id)
                                }
                              }}
                              className={isEnhancementDisabled && enhancingDocId !== doc.id ? "cursor-pointer" : ""}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEnhanceDocument(doc.id)
                                }}
                                disabled={isEnhancementDisabled || enhancingDocId === doc.id}
                                title={isEnhancementDisabled ? t('enhancementLimitReachedTitle') : t('enhanceWithGrokApi')}
                              >
                              {enhancingDocId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                            </Button>
                            </div>
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
                  )
                })()}
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
              hideEmptyState={(() => {
                const hasTimestamp = searchParams.has('_t')
                const tab = getTabFromUrl(searchParams)
                return hasTimestamp && tab === 'tests'
              })()}
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
                
                // Map assigned users from the users array - exclude managers
                const assignedUsers = (a.users || [])
                  .map((user: AssignedUser) => {
                    // Find the full user details from savedUsers
                    const fullUser = savedUsers.find(u => u.id === (user.userId || user.id))
                    return {
                      id: Number(fullUser?.id || user.userId || user.id || 0),
                      name: fullUser?.name || t('unknownUser'),
                      email: fullUser?.email || '',
                      role: fullUser?.role || 'employee',
                      department: fullUser?.job || ''
                    }
                  })
                  .filter(user => user.role === 'employee') // Exclude managers from assignments
                
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
                  } : { id: 0, name: t('documentNotFound'), type: 'UNKNOWN', uploadedAt: a.createdAt },
                  test: test ? {
                    id: test.id,
                    title: test.title,
                    questionCount: test.questionCount || 0
                  } : a.testId ? { id: a.testId, title: t('testNotFound'), questionCount: 0 } : { id: '', title: t('noTest'), questionCount: 0 },
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
              hideEmptyState={(() => {
                const hasTimestamp = searchParams.has('_t')
                const tab = getTabFromUrl(searchParams)
                return hasTimestamp && tab === 'assignments'
              })()}
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
