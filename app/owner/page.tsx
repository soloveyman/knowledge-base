"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useMemo, useCallback, Suspense, useRef } from "react"
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
import { cleanupDocumentFromLocalStorage, syncLocalStorageWithDatabase } from "@/lib/localStorage-utils"
import { formatDateShort } from "@/lib/date-format"
import dynamic from "next/dynamic"

// Lazy load heavy tab components to reduce initial bundle size
const UsersPage = dynamic(() => import("@/components/pages/users-page").then(mod => ({ default: mod.UsersPage })), {
  loading: () => <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div></div>,
  ssr: false
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
  
  // Initialize state without blocking render - load from localStorage asynchronously
  const [savedTests, setSavedTests] = useState<SavedTest[]>([])
  const [savedAssignments, setSavedAssignments] = useState<SavedAssignment[]>([])
  const [documents, setDocuments] = useState<SavedDocument[]>([])
  const [savedUsers, setSavedUsers] = useState<SavedUser[]>([])
  
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false)
  const [isLoadingTests, setIsLoadingTests] = useState(false)
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)
  
  // Load from localStorage asynchronously after initial render to avoid blocking FCP
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const savedTests = localStorage.getItem('owner-tests')
      if (savedTests) {
        setSavedTests(JSON.parse(savedTests))
      }
    } catch {
      // Ignore errors
    }
    
    try {
      const savedAssignments = localStorage.getItem('owner-assignments')
      if (savedAssignments) {
        setSavedAssignments(JSON.parse(savedAssignments))
      }
    } catch {
      // Ignore errors
    }
    
    try {
      const savedDocuments = localStorage.getItem('owner-documents')
      if (savedDocuments) {
        setDocuments(JSON.parse(savedDocuments))
      }
    } catch {
      // Ignore errors
    }
  }, []) // Run once on mount

  // Set documents with localStorage persistence for smoother reloads
  const setDocumentsWithLog = (newDocuments: SavedDocument[]) => {
    setDocuments(newDocuments)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('owner-documents', JSON.stringify(newDocuments))
        // Also sync to localStorage using the utility function for consistency
        // Cast to Document[] type to match the utility function signature
        syncLocalStorageWithDatabase(newDocuments as unknown as Array<{ id: string; name?: string; type?: string; [key: string]: unknown }>)
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

  // Restore tab from sessionStorage on mount if not in URL (only once on mount)
  useEffect(() => {
    const tabFromUrl = getTabFromUrl(searchParams)
    if (!tabFromUrl) {
      const previousTab = getPreviousTab('owner')
      if (previousTab && previousTab !== 'overview' && ['overview', 'users', 'docs', 'tests', 'assignments', 'settings'].includes(previousTab)) {
        // Update URL to include the restored tab (only if not already in URL)
        router.replace(`/owner?tab=${previousTab}`, { scroll: false })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount to prevent refresh loops

  // Save current tab when it changes
  useEffect(() => {
    if (defaultTab) {
      saveCurrentTab('owner', defaultTab)
    }
  }, [defaultTab])

  // Handle auth redirect without blocking initial render
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
      // Set loading states if we're refreshing (but not when preserving data to avoid flicker)
      if (!preserveData) {
        setIsLoadingDocuments(true)
        setIsLoadingTests(true)
        setIsLoadingAssignments(true)
      } else {
        // When preserving data, ensure loading states are cleared at the start
        // This prevents stuck loading states from previous operations
        setIsLoadingDocuments(false)
        setIsLoadingTests(false)
        setIsLoadingAssignments(false)
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
        // Exclude the signed-in owner from the Users tab to reflect team members only
        setSavedUsers((usersResult.data.users as SavedUser[]).filter(u => u.id !== (session?.user?.id || '')))
      }

      // Process assignments
      if (assignmentsResult.success) {
        console.log('Owner: Loaded assignments from API:', assignmentsResult.data.assignments)
        setSavedAssignmentsWithLog(assignmentsResult.data.assignments)
      }

      // Process documents first (needed for test sourceDocument lookup)
      console.log('Owner: Loading documents, session user:', session?.user)
      console.log('Owner: Session businessId:', session?.user?.businessId)
      console.log('Owner: Documents API response:', documentsResult)
      
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
        console.log('Owner: Raw documents from API:', documentsResult.data.documents)
        console.log('Owner: Number of documents:', documentsResult.data.documents?.length || 0)
        
        if (documentsResult.data.documents && Array.isArray(documentsResult.data.documents) && documentsResult.data.documents.length > 0) {
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
          console.log('Owner: No documents in API response')
          // NEVER clear documents if preserveData is true - this prevents empty state flicker
          // Only clear if preserveData is false AND we're not on docs tab AND documents array is empty
          if (!preserveData && defaultTab !== 'docs' && documents.length === 0) {
            setDocumentsWithLog([])
          } else {
            console.log('Owner: Keeping existing documents to avoid empty state flicker', {
              preserveData,
              defaultTab,
              documentsLength: documents.length
            })
          }
        }
      } else {
        console.error('Owner: Documents API failed:', documentsResult.message || documentsResult.error)
        // NEVER clear documents if preserveData is true - this prevents empty state flicker
        // Only clear if preserveData is false AND documents array is empty
        if (!preserveData && documents.length === 0) {
          setDocumentsWithLog([])
        } else {
          console.log('Owner: Keeping existing documents after API error to avoid empty state flicker')
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
        console.log('Owner: Keeping existing documents after error to avoid empty state flicker')
      }
    } finally {
      // Clear loading states
      setIsLoadingDocuments(false)
      setIsLoadingTests(false)
      setIsLoadingAssignments(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  // Preload subscription data only (tab data is loaded by tab-specific useEffect)
  useEffect(() => {
    // Only run on client side and after session is ready
    if (typeof window === 'undefined' || status === 'loading' || !session) return
    
    // Preload subscription data in parallel (non-blocking) for instant tab switch
    fetch('/api/subscription', { cache: 'no-store' }).catch(() => {
      // Silently fail - SubscriptionManager will load it if needed
    })
  }, [status, session])

  // Tab-specific loading functions - only load what's needed for each tab
  const loadTabData = useCallback(async (tab: string, preserveData = false, forceRefresh = false) => {
    try {
      if (tab === 'docs') {
        // Always show loading when fetching, but preserve existing data if preserveData is true
        setIsLoadingDocuments(true)
        try {
          // Use cache-busting if forceRefresh is true (e.g., returning from import)
          const fetchOptions = forceRefresh 
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
              moduleId?: string | null
              parsedContent?: { metadata?: { enhancedBy?: string; enhancementTimestamp?: number } } | null
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
            setDocumentsWithLog(transformedDocs)
            // Ensure localStorage is synced immediately
            // Cast to Document[] type to match the utility function signature
            syncLocalStorageWithDatabase(transformedDocs as unknown as Array<{ id: string; name?: string; type?: string; [key: string]: unknown }>)
          }
        } finally {
          setIsLoadingDocuments(false)
        }
      } else if (tab === 'tests') {
        setIsLoadingTests(!preserveData)
        // Tests need documents for sourceDocument lookup
        // Use cache-busting if forceRefresh is true (e.g., returning from test-builder)
        const fetchOpts = forceRefresh 
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
        setIsLoadingTests(false)
      } else if (tab === 'assignments') {
        setIsLoadingAssignments(!preserveData)
        // Assignments need all data for mapping
        // Use forceRefresh to ensure fresh data when returning from assignment-builder
        await loadData(preserveData, forceRefresh)
      } else if (tab === 'users') {
        // Check if returning from user-builder (has timestamp) - use cache-busting
        const hasTimestamp = searchParams.has('_t')
        const fetchOptions: RequestInit = hasTimestamp 
          ? { cache: 'no-store' } // Force fresh data when returning from create/edit
          : { next: { revalidate: 30 } } // Otherwise use stale-while-revalidate
        
        const response = await fetch('/api/users', fetchOptions)
        const result = await response.json()
        if (result.success) {
          setSavedUsers((result.data.users as SavedUser[]).filter(u => u.id !== (session?.user?.id || '')))
        }
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
  }, [loadData, session?.user?.id, searchParams])

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
          console.log('Owner: Docs tab activated, loading documents...')
          await loadTabData('docs', true)
        } else if (defaultTab === 'tests') {
          console.log('Owner: Tests tab activated, loading tests...')
          await loadTabData('tests', true)
        } else if (defaultTab === 'assignments') {
          console.log('Owner: Assignments tab activated, loading assignments...')
          await loadTabData('assignments', true)
        } else if (defaultTab === 'overview') {
          console.log('Owner: Overview tab activated, loading data...')
          await loadTabData('overview', true)
        } else if (defaultTab === 'users') {
          console.log('Owner: Users tab activated, loading users...')
          await loadTabData('users', true)
        }
      } finally {
        isLoadingRef.current = false
      }
    }
    
    loadTab()
  }, [defaultTab, loadTabData])

  // Reload data when returning from edit/create pages (detected via URL parameters)
  useEffect(() => {
    const checkAndReload = () => {
      // Check window.location.search first for immediate detection (works before searchParams updates)
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : searchParams
      const tab = urlParams.get('tab') || getTabFromUrl(searchParams) || defaultTab
      const hasTimestamp = urlParams.has('_t') || searchParams.has('_t')
      
      // If we have a timestamp parameter, it means we're returning from a create/edit page
      // Force reload the appropriate tab to show newly saved/updated data
      if (hasTimestamp && tab) {
        console.log(`Owner: Detected return from edit/create, reloading ${tab} tab...`)
        // Reset last loaded tab ref to force reload even if same tab
        lastLoadedTabRef.current = null
        isLoadingRef.current = false
        
        // Use cache-busting to ensure fresh data - fetch immediately
        if (tab === 'docs') {
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
                  moduleId?: string | null
                  parsedContent?: { metadata?: { enhancedBy?: string; enhancementTimestamp?: number } } | null
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
                setDocumentsWithLog(transformedDocs)
                // Ensure localStorage is synced immediately
                // Cast to Document[] type to match the utility function signature
                syncLocalStorageWithDatabase(transformedDocs as unknown as Array<{ id: string; name?: string; type?: string; [key: string]: unknown }>)
                lastLoadedTabRef.current = tab
              }
            })
            .catch(console.error)
        } else if (tab === 'users') {
          // Direct fetch for users with cache-busting
          fetch('/api/users', { cache: 'no-store' })
            .then(res => res.json())
            .then(result => {
              if (result.success) {
                setSavedUsers((result.data.users as SavedUser[]).filter(u => u.id !== (session?.user?.id || '')))
                lastLoadedTabRef.current = tab
              }
            })
            .catch(console.error)
        } else {
          // For tests and assignments, use loadTabData with forceRefresh=true
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
        checkAndReload()
      }
      
      // Listen for both popstate and custom navigation events
      window.addEventListener('popstate', handlePopState)
      window.addEventListener('locationchange', handlePopState)
      
      return () => {
        window.removeEventListener('popstate', handlePopState)
        window.removeEventListener('locationchange', handlePopState)
      }
    }
  }, [searchParams, loadTabData, session?.user?.id, defaultTab])

  // Reload data when tab changes to settings
  useEffect(() => {
    if (defaultTab === 'settings') {
      console.log('Owner: Settings tab activated')
      // Settings tab will handle its own data loading via SubscriptionManager
    }
  }, [defaultTab])

  // Reload data when page becomes visible (e.g., when returning from document viewer or test page)
  // Only reload if we've been away for more than 30 seconds to avoid unnecessary refreshes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && defaultTab && ['docs', 'tests', 'assignments', 'overview', 'users'].includes(defaultTab)) {
        const lastFocusTime = sessionStorage.getItem('ownerLastFocusTime')
        const now = Date.now()
        // Only reload if away for more than 30 seconds
        if (!lastFocusTime || (now - parseInt(lastFocusTime)) > 30000) {
          console.log(`Owner: Page became visible after ${now - (lastFocusTime ? parseInt(lastFocusTime) : 0)}ms, reloading ${defaultTab} tab...`)
          // Use requestIdleCallback to avoid blocking UI
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
              if (defaultTab === 'overview') {
                loadData(true, true).catch(console.error)
              } else {
                loadTabData(defaultTab, true).catch(console.error)
              }
            })
          } else {
            setTimeout(() => {
              if (defaultTab === 'overview') {
                loadData(true, true).catch(console.error)
              } else {
                loadTabData(defaultTab, true).catch(console.error)
              }
            }, 100)
          }
          sessionStorage.setItem('ownerLastFocusTime', now.toString())
        }
      }
    }

    const handleFocus = () => {
      if (defaultTab && ['docs', 'tests', 'assignments', 'overview', 'users'].includes(defaultTab)) {
        const lastFocusTime = sessionStorage.getItem('ownerLastFocusTime')
        const now = Date.now()
        // Only reload if away for more than 30 seconds
        if (!lastFocusTime || (now - parseInt(lastFocusTime)) > 30000) {
          console.log(`Owner: Window focused after ${now - (lastFocusTime ? parseInt(lastFocusTime) : 0)}ms, reloading ${defaultTab} tab...`)
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
              if (defaultTab === 'overview') {
                loadData(true, true).catch(console.error)
              } else {
                loadTabData(defaultTab, true).catch(console.error)
              }
            })
          } else {
            setTimeout(() => {
              if (defaultTab === 'overview') {
                loadData(true, true).catch(console.error)
              } else {
                loadTabData(defaultTab, true).catch(console.error)
              }
            }, 100)
          }
          sessionStorage.setItem('ownerLastFocusTime', now.toString())
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

  // Document handlers
  const [enhancingDocId, setEnhancingDocId] = useState<string | null>(null)

  const handleEnhanceDocument = async (id: string) => {
    try {
      setEnhancingDocId(id)
      toast.loading('Enhancing document with Grok API...', { id: 'enhance' })
      
      const response = await fetch(`/api/documents/${id}/enhance`, {
        method: 'POST',
        cache: 'no-store'
      })
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        let errorMessage = 'Failed to enhance document'
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.message || errorMessage
        } catch {
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`
        }
        console.error('Failed to enhance document:', errorMessage)
        toast.error(errorMessage, { id: 'enhance' })
        return
      }
      
      const result = await response.json()
      
      if (result.success) {
        toast.success('Document enhanced successfully!', { id: 'enhance' })
        // Reload documents to show updated content - use preserveData=true to avoid flicker
        // loadData's finally block will clear loading states
        await loadData(true)
      } else {
        console.error('Failed to enhance document:', result.message)
        toast.error(result.message || 'Failed to enhance document', { id: 'enhance' })
      }
    } catch (error) {
      console.error('Error enhancing document:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Error enhancing document: ${errorMessage}`, { id: 'enhance' })
      // Ensure loading state is cleared on error (loadData might not have been called)
      setIsLoadingDocuments(false)
    } finally {
      setEnhancingDocId(null)
    }
  }

  const handleDeleteDocument = async (id: string) => {
    // Optimistically remove from state immediately for instant UI update
    const previousDocuments = documents
    setDocumentsWithLog(documents.filter(doc => doc.id !== id))
    cleanupDocumentFromLocalStorage(id)
    
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
        setDocumentsWithLog(previousDocuments)
        console.error('Failed to delete document:', result.message)
        toast.error(result.message || 'Failed to delete document')
      }
    } catch (error) {
      // Revert on error - restore previous state
      setDocumentsWithLog(previousDocuments)
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

  // Prefetch common routes on hover for better UX
  const handleDocumentHover = useCallback((id: string) => {
    const url = `/docs/${encodeURIComponent(id)}`
    router.prefetch(url)
  }, [router])

  const handleImportDocument = () => {
    router.push('/docs/import?returnTo=/owner?tab=docs')
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
    router.push(`/test/${id}`)
  }

  const handleEditTest = (id: string) => {
    const url = `/test-builder?edit=${id}&returnTo=/owner?tab=tests`
    router.prefetch(url)
    router.push(url)
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
    const url = `/assignment-builder?edit=${id}&returnTo=/owner?tab=assignments`
    router.prefetch(url)
    router.push(url)
  }

  // User handlers
  const handleDeleteUser = async (id: string) => {
    // Optimistically remove from state immediately for instant UI update
    const previousUsers = savedUsers
    setSavedUsers(savedUsers.filter(u => u.id !== id))
    
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        cache: 'no-store'
      })
      const result = await response.json()
      
      if (result.success) {
        toast.success('User deleted successfully')
        // No need to reload - state already updated
      } else {
        // Revert on error - restore previous state
        setSavedUsers(previousUsers)
        console.error('Failed to delete user:', result.message)
        toast.error(result.message || 'Failed to delete user')
      }
    } catch (error) {
      // Revert on error - restore previous state
      setSavedUsers(previousUsers)
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

  // Memoize completion rate calculation to avoid recalculating on every render
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

  // Show skeleton immediately instead of blocking on session/auth
  // This improves FCP significantly
  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-16 bg-background border-b" />
        <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8">
          <div className="h-20 bg-muted rounded-lg animate-pulse mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    )
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
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8">
        <GreetingCard
          name={session.user?.name || t('owner')}
        />

        {/* Main Tabs */}
        <Tabs value={defaultTab} onValueChange={(value) => {
          if (value && ['overview', 'users', 'docs', 'tests', 'assignments', 'settings'].includes(value)) {
            // Only update if tab actually changed to prevent unnecessary router calls
            if (value !== defaultTab) {
              router.replace(`/owner?tab=${value}`, { scroll: false })
              saveCurrentTab('owner', value)
              // Reset last loaded tab ref when switching tabs to allow reload
              lastLoadedTabRef.current = null
            }
          }
        }} className="space-y-3 md:space-y-6">
          <TabsContainer>
            <TabsList className="w-full min-w-max grid grid-cols-3 sm:grid-cols-6">
              <TabsTrigger 
                value="overview"
                onMouseEnter={() => router.prefetch('/owner?tab=overview')}
              >
                {t('overview')}
              </TabsTrigger>
              <TabsTrigger 
                value="users"
                onMouseEnter={() => router.prefetch('/owner?tab=users')}
              >
                {t('users')}
              </TabsTrigger>
              <TabsTrigger 
                value="docs"
                onMouseEnter={() => router.prefetch('/owner?tab=docs')}
              >
                {t('documents')}
              </TabsTrigger>
              <TabsTrigger 
                value="tests"
                onMouseEnter={() => router.prefetch('/owner?tab=tests')}
              >
                {t('tests')}
              </TabsTrigger>
              <TabsTrigger 
                value="assignments"
                onMouseEnter={() => router.prefetch('/owner?tab=assignments')}
              >
                {t('assignments')}
              </TabsTrigger>
              <TabsTrigger 
                value="settings"
                onMouseEnter={() => router.prefetch('/owner?tab=settings')}
              >
                {t('subscriptions')}
              </TabsTrigger>
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
              hideEmptyState={(() => {
                const hasTimestamp = searchParams.has('_t')
                const tab = getTabFromUrl(searchParams)
                return hasTimestamp && tab === 'users'
              })()}
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
                        className="flex items-center justify-between p-4 border border-border rounded-3xl hover:bg-accent cursor-pointer gap-3 transition-opacity duration-100"
                        onClick={() => handleViewDocument(doc.id, doc.name)}
                        onMouseEnter={() => handleDocumentHover(doc.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground dark:text-white truncate">{doc.name}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-muted-foreground truncate">Uploaded {doc.uploadedAt}</p>
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
              hideEmptyState={(() => {
                const hasTimestamp = searchParams.has('_t')
                const tab = getTabFromUrl(searchParams)
                return hasTimestamp && tab === 'assignments'
              })()}
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
