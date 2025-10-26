"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useMemo, useLayoutEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppBar } from "@/components/common/app-bar"
import { EmptyState } from "@/components/common/empty-state"
import { 
  Users, 
  ClipboardList, 
  BarChart3, 
  FileText,
  X
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

interface SavedAssignment {
  id: string
  name: string
  description: string
  document: {
    id: number
    name: string
    type: string
    uploadedAt: string
  }
  test: SavedTest
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

export default function ManagerPage() {
  const { data: session, status } = useSession()
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

  // Load data from APIs
  const loadData = useCallback(async (preserveDocuments = false) => {
    try {
      // Set loading states if we're refreshing
      if (preserveDocuments) {
        setIsLoadingDocuments(true)
        setIsLoadingTests(true)
        setIsLoadingAssignments(true)
      }

      // Load users
      const usersResponse = await fetch('/api/users')
      const usersResult = await usersResponse.json()
      if (usersResult.success) {
        setSavedUsers(usersResult.data.users)
      }

      // Load assignments
      const assignmentsResponse = await fetch('/api/assignments')
      const assignmentsResult = await assignmentsResponse.json()
      if (assignmentsResult.success) {
        setSavedAssignmentsWithLog(assignmentsResult.data.assignments)
      }

      // Load tests
      const testsResponse = await fetch('/api/tests')
      const testsResult = await testsResponse.json()
      if (testsResult.success) {
        setSavedTestsWithLog(testsResult.data.tests)
      }

      // Load documents
      const documentsResponse = await fetch('/api/documents')
      const documentsResult = await documentsResponse.json()
      if (documentsResult.success) {
        console.log('Manager: Raw documents from API:', documentsResult.data.documents)
        // Transform database documents to match the expected format
        const transformedDocs = documentsResult.data.documents.map((doc: {
          id: string
          originalFileName?: string
          title: string
          fileType?: string
          createdAt: string
          fileSize?: number
          status?: string
        }) => ({
          id: doc.id,
          name: doc.originalFileName || doc.title,
          type: doc.fileType?.toUpperCase() || 'UNKNOWN',
          uploadedAt: new Date(doc.createdAt).toLocaleDateString(),
          size: doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown',
          status: doc.status || 'ready'
        }))
        console.log('Manager: Transformed documents:', transformedDocs)
        setDocumentsWithLog(transformedDocs)
        
        // Sync localStorage with database to remove stale data
        syncLocalStorageWithDatabase(transformedDocs)
      } else if (!preserveDocuments) {
        // Only clear documents if we're not preserving them and the API call failed
        setDocumentsWithLog([])
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

  // Reload data when tab changes to docs
  useEffect(() => {
    if (defaultTab === 'docs') {
      console.log('Manager: Docs tab activated, reloading documents...')
      // Use setTimeout to avoid synchronous setState in effect
      // Preserve documents during refresh to avoid empty state
      setTimeout(() => loadData(true), 0)
    }
  }, [defaultTab, loadData])

  // Reload data when tab changes to tests
  useEffect(() => {
    if (defaultTab === 'tests') {
      console.log('Manager: Tests tab activated, reloading tests...')
      // Use setTimeout to avoid synchronous setState in effect
      // Preserve tests during refresh to avoid empty state
      setTimeout(() => loadData(true), 0)
    }
  }, [defaultTab, loadData])

  // Reload data when tab changes to assignments
  useEffect(() => {
    if (defaultTab === 'assignments') {
      console.log('Manager: Assignments tab activated, reloading assignments...')
      // Use setTimeout to avoid synchronous setState in effect
      // Preserve assignments during refresh to avoid empty state
      setTimeout(() => loadData(true), 0)
    }
  }, [defaultTab, loadData])

  // Reload data when page becomes visible (e.g., when returning from document viewer)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && (defaultTab === 'docs' || defaultTab === 'tests' || defaultTab === 'assignments')) {
        console.log('Manager: Page became visible, reloading data...')
        setTimeout(() => loadData(true), 0)
      }
    }

    const handleFocus = () => {
      if (defaultTab === 'docs' || defaultTab === 'tests' || defaultTab === 'assignments') {
        console.log('Manager: Window focused, reloading data...')
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
  const handleDeleteDocument = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      
      if (result.success) {
        setDocumentsWithLog(documents.filter(doc => doc.id !== id))
        
        // Clean up localStorage when document is deleted
        cleanupDocumentFromLocalStorage(id)
        
        // Ensure we stay on the docs tab after deletion
        router.push('/manager?tab=docs')
      } else {
        console.error('Failed to delete document:', result.message)
      }
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  const handleViewDocument = (name: string) => {
    console.log('Manager: handleViewDocument called with name:', name)
    console.log('Manager: Encoded name:', encodeURIComponent(name))
    router.push(`/docs/${encodeURIComponent(name)}`)
  }

  const handleImportDocument = () => {
    router.push('/docs/import?returnTo=/manager?tab=docs')
  }

  // Test handlers
  const handleDeleteTest = async (id: string) => {
    try {
      const response = await fetch(`/api/tests/${id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      
      if (result.success) {
        setSavedTestsWithLog(savedTests.filter(t => t.id !== id))
      } else {
        console.error('Failed to delete test:', result.message)
      }
    } catch (error) {
      console.error('Error deleting test:', error)
    }
  }

  const handleViewTest = (id: string) => {
    console.log('Open test:', id)
  }

  const handleEditTest = (id: string) => {
    // Redirect to test builder with edit parameter
    router.push(`/test-builder?edit=${id}`)
  }

  // Assignment handlers
  const handleDeleteAssignment = async (id: string) => {
    try {
      const response = await fetch(`/api/assignments/${id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      
      if (result.success) {
        setSavedAssignmentsWithLog(savedAssignments.filter(a => a.id !== id))
      } else {
        console.error('Failed to delete assignment:', result.message)
      }
    } catch (error) {
      console.error('Error deleting assignment:', error)
    }
  }

  const handleViewAssignment = (id: string) => {
    console.log('Open assignment:', id)
  }

  const handleEditAssignment = (id: string) => {
    // Redirect to assignment builder with edit parameter
    router.push(`/assignment-builder?edit=${id}`)
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
    <div className="min-h-screen bg-gray-50">
      <AppBar role="manager" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back, {session.user?.name || 'Manager'}!
          </h2>
          <p className="text-gray-600">
            Manage your team&apos;s training and knowledge base
          </p>
        </div>


        {/* Main Tabs */}
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="docs">Docs</TabsTrigger>
            <TabsTrigger value="tests">Tests</TabsTrigger>
            <TabsTrigger value="assignments">Assign</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Overview Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{savedUsers.length}</div>
                  <p className="text-xs text-muted-foreground">Total employees</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Training</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{savedAssignments.length}</div>
                  <p className="text-xs text-muted-foreground">Total assignments</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Documents</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{documents.length}</div>
                  <p className="text-xs text-muted-foreground">Total documents</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {savedAssignments.length > 0 
                      ? Math.round((savedAssignments.filter(a => a.status === 'completed').length / savedAssignments.length) * 100)
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {savedAssignments.filter(a => a.status === 'completed').length} of {savedAssignments.length} completed
                  </p>
                </CardContent>
              </Card>
            </div>

            <UserProgressReport 
              users={savedUsers} 
              assignments={savedAssignments} 
            />

          </TabsContent>


          <TabsContent value="docs" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <CardTitle>Uploaded Documents</CardTitle>
                    <CardDescription>View and manage your uploaded documents</CardDescription>
                  </div>
                  <Button 
                    className="w-full sm:w-auto"
                    onClick={handleImportDocument}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Import Document
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingDocuments ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <span className="ml-3 text-gray-600">Refreshing documents...</span>
                  </div>
                ) : documents.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="h-12 w-12" />}
                    title="No documents uploaded yet"
                    description="Get started by importing your first document to create training materials and tests."
                    actionLabel="Import Document"
                    onAction={handleImportDocument}
                  />
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div 
                        key={doc.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleViewDocument(doc.name)}
                      >
                        <div>
                          <h3 className="font-medium text-gray-900">{doc.name}</h3>
                          <p className="text-sm text-gray-500">Uploaded {doc.uploadedAt}</p>
                        </div>
                        <DeleteConfirmation
                          onConfirm={() => handleDeleteDocument(doc.id)}
                          itemName={doc.name}
                          trigger={
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-gray-400 hover:text-gray-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tests" className="space-y-6">
            <TestsPage
              tests={savedTests}
              onDeleteTest={handleDeleteTest}
              onViewTest={handleViewTest}
              onEditTest={handleEditTest}
              isLoading={isLoadingTests}
            />
          </TabsContent>

          <TabsContent value="assignments" className="space-y-6">
            <AssignmentsPage
              assignments={savedAssignments}
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
