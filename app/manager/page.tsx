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
import { toast } from "sonner"
import { 
  FileText,
  X,
  Sparkles,
  Loader2
} from "lucide-react"
import { DeleteConfirmation } from "@/components/common/delete-confirmation"
import dynamic from "next/dynamic"

// Lazy load heavy tab components to reduce initial bundle size
const TestsPage = dynamic(() => import("@/components/pages/tests-page").then(mod => ({ default: mod.TestsPage })), {
  loading: () => <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div></div>,
  ssr: false // Disable SSR for better performance on client-side only components
})
const AssignmentsPage = dynamic(() => import("@/components/pages/assignments-page").then(mod => ({ default: mod.AssignmentsPage })), {
  loading: () => <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div></div>,
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
    return tab && ['overview', 'docs', 'tests', 'assignments'].includes(tab) ? tab : "overview"
  }, [searchParams])

  // Restore tab from sessionStorage on mount if not in URL (only once on mount)
  useEffect(() => {
    const tabFromUrl = getTabFromUrl(searchParams)
    if (!tabFromUrl) {
      const previousTab = getPreviousTab('manager')
      if (previousTab && previousTab !== 'overview' && ['overview', 'docs', 'tests', 'assignments'].includes(previousTab)) {
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

      // Process users
      if (usersResult.success) {
        setSavedUsers(usersResult.data.users)
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
          }
        } finally {
          setIsLoadingTests(false)
        }
      } else if (tab === 'assignments') {
        setIsLoadingAssignments(!preserveData)
        // Assignments need all data for mapping
        // Use forceRefresh to ensure fresh data when returning from assignment-builder
        await loadData(preserveData, forceRefresh)
      } else if (tab === 'overview') {
        // Overview needs all data
        await loadData(preserveData)
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
    // Skip if this tab was already loaded and not forced (prevent duplicate loads)
    if (lastLoadedTabRef.current === defaultTab && !isLoadingRef.current) {
      return
    }
    
    // Skip if already loading
    if (isLoadingRef.current) {
      return
    }
    
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
        }
      } finally {
        isLoadingRef.current = false
      }
    }
    
    loadTab()
  }, [defaultTab, loadTabData])

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
      // Also reload if tab changed and we haven't loaded it yet
      const shouldReload = (hasTimestamp && tab && timestamp !== processedTimestampRef.current) || 
                          (tab && tab !== lastLoadedTabRef.current && !isLoadingRef.current)
      
      if (shouldReload) {
        if (hasTimestamp && timestamp !== processedTimestampRef.current) {
          console.log(`Manager: Detected return from edit/create, reloading ${tab} tab...`)
          // Mark this timestamp as processed to prevent duplicate calls
          processedTimestampRef.current = timestamp
          
          // First, check sessionStorage for pre-fetched data (faster than API call)
          if (typeof window !== 'undefined') {
            if (tab === 'docs') {
              const pendingDocs = sessionStorage.getItem('pendingDocumentsRefresh')
              if (pendingDocs) {
                try {
                  const { data, timestamp: storedTimestamp } = JSON.parse(pendingDocs)
                  // Only use if timestamp is recent (within last 10 seconds)
                  if (Date.now() - storedTimestamp < 10000 && data) {
                    console.log('Manager: Using pre-fetched documents from sessionStorage')
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
                    return // Skip API call since we have the data
                  }
                } catch (error) {
                  console.error('Failed to parse pending documents:', error)
                }
              }
            } else if (tab === 'tests') {
              const pendingTests = sessionStorage.getItem('pendingTestsRefresh')
              if (pendingTests) {
                try {
                  const { tests, documents, timestamp: storedTimestamp } = JSON.parse(pendingTests)
                  // Only use if timestamp is recent (within last 10 seconds)
                  if (Date.now() - storedTimestamp < 10000 && tests && documents) {
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
                    setSavedTestsWithLog(transformedTests)
                    sessionStorage.removeItem('pendingTestsRefresh')
                    lastLoadedTabRef.current = tab
                    return // Skip API call since we have the data
                  }
                } catch (error) {
                  console.error('Failed to parse pending tests:', error)
                }
              }
            } else if (tab === 'assignments') {
              const pendingAssignments = sessionStorage.getItem('pendingAssignmentsRefresh')
              if (pendingAssignments) {
                try {
                  const { data, timestamp: storedTimestamp } = JSON.parse(pendingAssignments)
                  // Only use if timestamp is recent (within last 10 seconds)
                  if (Date.now() - storedTimestamp < 10000 && data) {
                    console.log('Manager: Using pre-fetched assignments from sessionStorage')
                    setSavedAssignmentsWithLog(data)
                    sessionStorage.removeItem('pendingAssignmentsRefresh')
                    lastLoadedTabRef.current = tab
                    return // Skip API call since we have the data
                  }
                } catch (error) {
                  console.error('Failed to parse pending assignments:', error)
                }
              }
            }
          }
        } else {
          console.log(`Manager: Tab changed to ${tab}, loading data...`)
        }
        // Reset last loaded tab ref to force reload even if same tab
        lastLoadedTabRef.current = null
        isLoadingRef.current = false
        
        // Use cache-busting to ensure fresh data - fetch immediately
        if (tab === 'docs') {
          // Direct fetch for documents with cache-busting
          fetch('/api/documents', { cache: 'no-store' })
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
            })
            .catch(console.error)
        } else if (tab === 'tests') {
          // Direct fetch for tests with cache-busting - fetch tests and documents in parallel
          Promise.all([
            fetch('/api/tests', { cache: 'no-store' }),
            fetch('/api/documents', { cache: 'no-store' })
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
      let intervalId: NodeJS.Timeout | null = null
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : searchParams
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
      
      return () => {
        window.removeEventListener('popstate', handlePopState)
        window.removeEventListener('locationchange', handlePopState)
        if (intervalId) clearInterval(intervalId)
      }
    }
  }, [searchParams, loadTabData, defaultTab])

  // Reload data when page becomes visible (e.g., when returning from document viewer or test page)
  // Only reload if we've been away for more than 30 seconds to avoid unnecessary refreshes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && defaultTab && ['docs', 'tests', 'assignments', 'overview'].includes(defaultTab)) {
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
      if (defaultTab && ['docs', 'tests', 'assignments', 'overview'].includes(defaultTab)) {
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
    try {
      setEnhancingDocId(id)
      toast.loading('Enhancing document with Grok API...', { id: 'enhance' })
      
      const response = await fetch(`/api/documents/${id}/enhance`, {
        method: 'POST',
        cache: 'no-store'
      })
      const result = await response.json()
      
      startTransition(() => {
        if (result.success) {
          toast.success('Document enhanced successfully!', { id: 'enhance' })
          // Reload documents to show updated content
          loadData(false)
        } else {
          console.error('Failed to enhance document:', result.message)
          toast.error(result.message || 'Failed to enhance document', { id: 'enhance' })
        }
      })
    } catch (error) {
      console.error('Error enhancing document:', error)
      toast.error('Error enhancing document', { id: 'enhance' })
    } finally {
      setEnhancingDocId(null)
    }
  }

  const handleDeleteDocument = async (id: string) => {
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
      const result = await response.json()
      
      if (result.success) {
        toast.success('Document deleted successfully')
        // No need to reload - state already updated
      } else {
        // Revert on error - restore previous state
        startTransition(() => {
          setDocumentsWithLog(previousDocuments)
        })
        console.error('Failed to delete document:', result.message)
        toast.error(result.message || 'Failed to delete document')
      }
    } catch (error) {
      // Revert on error - restore previous state
      startTransition(() => {
        setDocumentsWithLog(previousDocuments)
      })
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
        toast.success('Test deleted successfully')
        // No need to reload - state already updated
      } else {
        // Revert on error - restore previous state
        setSavedTestsWithLog(previousTests)
        console.error('Failed to delete test:', result.message)
        toast.error(result.message || 'Failed to delete test')
      }
    } catch (error) {
      // Revert on error - restore previous state
      setSavedTestsWithLog(previousTests)
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
        toast.success('Assignment deleted successfully')
        // No need to reload - state already updated
      } else {
        // Revert on error - restore previous state
        setSavedAssignmentsWithLog(previousAssignments)
        console.error('Failed to delete assignment:', result.message)
        toast.error(result.message || 'Failed to delete assignment')
      }
    } catch (error) {
      // Revert on error - restore previous state
      setSavedAssignmentsWithLog(previousAssignments)
      console.error('Error deleting assignment:', error)
      toast.error('Error deleting assignment')
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
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8">
        <GreetingCard
          name={session.user?.name || t('manager')}
        />


        {/* Main Tabs */}
        <Tabs value={defaultTab} onValueChange={(value) => {
          if (value && ['overview', 'docs', 'tests', 'assignments'].includes(value)) {
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
            <TabsList className="grid w-full min-w-max grid-cols-4">
            <TabsTrigger 
              value="overview"
              onMouseEnter={() => router.prefetch('/manager?tab=overview')}
            >
              {t('overview')}
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
                {(() => {
                  // Check if we're returning from import (has timestamp parameter)
                  const hasTimestamp = searchParams.has('_t')
                  const tab = getTabFromUrl(searchParams)
                  const isReturningFromImport = hasTimestamp && tab === 'docs'
                  
                  // Show loading if actually loading
                  if (isLoadingDocuments) {
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
