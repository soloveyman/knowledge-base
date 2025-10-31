"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useMemo, useLayoutEffect, useCallback, Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UsersPage } from "@/components/pages/users-page"
import { TestsPage } from "@/components/pages/tests-page"
import { AssignmentsPage } from "@/components/pages/assignments-page"
import { AppBar } from "@/components/common/app-bar"
import { EmptyState } from "@/components/common/empty-state"
import { DeleteConfirmation } from "@/components/common/delete-confirmation"
import UserProgressReport from "@/components/reports/user-progress-report"
import { useTranslation } from "@/lib/translation-context"
import { 
  Users, 
  FileText, 
  ClipboardList, 
  BarChart3, 
  Settings,
  X
} from "lucide-react"
import { saveCurrentTab, getTabFromUrl } from "@/lib/redirect-utils"
import { cleanupDocumentFromLocalStorage, fixCorruptedLocalStorage } from "@/lib/localStorage-utils"

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
}

function OwnerPageInner() {
  const { data: session, status } = useSession()
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Initialize tests from localStorage to prevent empty state on re-mount
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
  
  // Initialize assignments from localStorage to prevent empty state on re-mount
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
  
  // Initialize documents from localStorage to prevent empty state on re-mount
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

  // Debug wrapper for setDocuments
  const setDocumentsWithLog = (newDocuments: SavedDocument[]) => {
    console.log('Owner: setDocuments called with:', newDocuments.length, 'documents')
    // Only warn if we're clearing documents that existed before
    if (newDocuments.length === 0 && documents.length > 0) {
      console.log('Owner: WARNING - Documents being cleared!')
      console.trace('Owner: Stack trace for document clearing:')
    }
    // Always save to localStorage to persist across re-mounts (even if empty)
    try {
      localStorage.setItem('owner-documents', JSON.stringify(newDocuments))
    } catch (error) {
      console.error('Failed to save documents to localStorage:', error)
    }
    setDocuments(newDocuments)
  }

  // Debug wrapper for setSavedTests
  const setSavedTestsWithLog = (newTests: SavedTest[]) => {
    console.log('Owner: setSavedTests called with:', newTests.length, 'tests')
    // Only warn if we're clearing tests that existed before
    if (newTests.length === 0 && savedTests.length > 0) {
      console.log('Owner: WARNING - Tests being cleared!')
      console.trace('Owner: Stack trace for test clearing:')
    }
    // Always save to localStorage to persist across re-mounts (even if empty)
    try {
      localStorage.setItem('owner-tests', JSON.stringify(newTests))
    } catch (error) {
      console.error('Failed to save tests to localStorage:', error)
    }
    setSavedTests(newTests)
  }

  // Debug wrapper for setSavedAssignments
  const setSavedAssignmentsWithLog = (newAssignments: SavedAssignment[]) => {
    console.log('Owner: setSavedAssignments called with:', newAssignments.length, 'assignments')
    // Only warn if we're clearing assignments that existed before
    if (newAssignments.length === 0 && savedAssignments.length > 0) {
      console.log('Owner: WARNING - Assignments being cleared!')
      console.trace('Owner: Stack trace for assignment clearing:')
    }
    // Always save to localStorage to persist across re-mounts (even if empty)
    try {
      localStorage.setItem('owner-assignments', JSON.stringify(newAssignments))
    } catch (error) {
      console.error('Failed to save assignments to localStorage:', error)
    }
    setSavedAssignments(newAssignments)
  }

  // Fix any corrupted localStorage data on initialization
  useEffect(() => {
    fixCorruptedLocalStorage()
  }, [])

  // Monitor documents state changes
  useEffect(() => {
    console.log('Owner: Documents state changed to:', documents.length, 'documents')
    console.log('Owner: Current documents:', documents)
    
    // Check localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('owner-documents')
        console.log('Owner: localStorage documents:', saved ? JSON.parse(saved) : null)
      } catch (e) {
        console.error('Owner: Error reading localStorage:', e)
      }
    }
  }, [documents])

  // Get initial tab from URL parameter using useMemo to prevent re-renders
  const defaultTab = useMemo(() => {
    const tab = getTabFromUrl(searchParams)
    return tab && ['overview', 'users', 'docs', 'tests', 'assignments', 'settings'].includes(tab) ? tab : "overview"
  }, [searchParams])

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
        // Exclude the signed-in owner from the Users tab to reflect team members only
        setSavedUsers((usersResult.data.users as SavedUser[]).filter(u => u.id !== (session?.user?.id || '')))
      }

      // Load assignments
      const assignmentsResponse = await fetch('/api/assignments')
      const assignmentsResult = await assignmentsResponse.json()
      if (assignmentsResult.success) {
        console.log('Owner: Loaded assignments from API:', assignmentsResult.data.assignments)
        setSavedAssignmentsWithLog(assignmentsResult.data.assignments)
      }

      // Load tests
      const testsResponse = await fetch('/api/tests')
      const testsResult = await testsResponse.json()
      if (testsResult.success) {
        setSavedTestsWithLog(testsResult.data.tests)
      }

      // Load documents
      console.log('Owner: Loading documents, session user:', session?.user)
      console.log('Owner: Session businessId:', session?.user?.businessId)
      const documentsResponse = await fetch('/api/documents')
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
            fileSize?: number
            status?: string
            moduleId?: string | null
          }) => ({
            id: doc.id,
            name: doc.originalFileName || doc.title,
            type: doc.fileType?.toUpperCase() || 'UNKNOWN',
            uploadedAt: new Date(doc.createdAt).toLocaleDateString(),
            size: doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown',
            status: doc.status || 'ready',
            moduleId: doc.moduleId || null
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
    }
    fetchData()
  }, [loadData])

  // Reload data when tab changes to docs
  useEffect(() => {
    if (defaultTab === 'docs') {
      console.log('Owner: Docs tab activated, reloading documents...')
      setTimeout(() => loadData(true), 0)
    }
  }, [defaultTab, loadData])

  // Reload data when tab changes to tests
  useEffect(() => {
    if (defaultTab === 'tests') {
      console.log('Owner: Tests tab activated, reloading tests...')
      setTimeout(() => loadData(true), 0)
    }
  }, [defaultTab, loadData])

  // Reload data when tab changes to assignments
  useEffect(() => {
    if (defaultTab === 'assignments') {
      console.log('Owner: Assignments tab activated, reloading assignments...')
      setTimeout(() => loadData(true), 0)
    }
  }, [defaultTab, loadData])

  // Reload data when tab changes to overview
  useEffect(() => {
    if (defaultTab === 'overview') {
      console.log('Owner: Overview tab activated, reloading data...')
      setTimeout(() => loadData(true), 0)
    }
  }, [defaultTab, loadData])

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
        router.push('/owner?tab=docs')
      } else {
        console.error('Failed to delete document:', result.message)
        alert(result.message)
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      alert('Error deleting document')
    }
  }

  const handleViewDocument = (name: string) => {
    console.log('Owner: handleViewDocument called with name:', name)
    console.log('Owner: Encoded name:', encodeURIComponent(name))
    router.push(`/docs/${encodeURIComponent(name)}`)
  }

  const handleImportDocument = () => {
    router.push('/docs/import?returnTo=/owner?tab=docs')
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
        setTimeout(() => loadData(true), 0)
      } else {
        console.error('Failed to delete test:', result.message)
        alert(result.message)
      }
    } catch (error) {
      console.error('Error deleting test:', error)
      alert('Error deleting test')
    }
  }

  const handleViewTest = (id: string) => {
    router.push(`/test/${id}`)
  }

  const handleEditTest = (id: string) => {
    router.push(`/test-builder?edit=${id}&returnTo=/owner?tab=tests`)
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
        setTimeout(() => loadData(true), 0)
      } else {
        console.error('Failed to delete assignment:', result.message)
        alert(result.message)
      }
    } catch (error) {
      console.error('Error deleting assignment:', error)
      alert('Error deleting assignment')
    }
  }

  const handleViewAssignment = (id: string) => {
    console.log('Open assignment:', id)
  }

  const handleEditAssignment = (id: string) => {
    router.push(`/assignment-builder?edit=${id}&returnTo=/owner?tab=assignments`)
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2">
            {t('welcome')}, {session.user?.name || t('owner')}!
          </h2>
          <p className="text-muted-foreground">
            {t('fullSystemControl')}
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue={defaultTab} className="space-y-3 md:space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="w-full min-w-max grid grid-cols-3 sm:grid-cols-6">
              <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
              <TabsTrigger value="users">{t('users')}</TabsTrigger>
              <TabsTrigger value="docs">{t('documents')}</TabsTrigger>
              <TabsTrigger value="tests">{t('tests')}</TabsTrigger>
              <TabsTrigger value="assignments">{t('assignments')}</TabsTrigger>
              <TabsTrigger value="settings">{t('settings')}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-3 md:space-y-6">
            {/* Overview Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('totalUsers')}</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{savedUsers.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {savedUsers.filter(u => u.role === 'manager').length} {t('managers')}, {savedUsers.filter(u => u.role === 'employee').length} {t('employees')}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('activeTraining')}</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{savedAssignments.length}</div>
                  <p className="text-xs text-muted-foreground">{t('totalAssignments')}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('documents')}</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{documents.length}</div>
                  <p className="text-xs text-muted-foreground">{t('totalDocuments')}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('completionRate')}</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
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
                    <CardTitle>{t('uploadedDocuments')}</CardTitle>
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
                    icon={<FileText className="h-12 w-12" />}
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
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent cursor-pointer gap-3"
                        onClick={() => handleViewDocument(doc.name)}
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground dark:text-white truncate">{doc.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">Uploaded {doc.uploadedAt}</p>
                        </div>
                        <div className="shrink-0">
                          <DeleteConfirmation
                            onConfirm={() => handleDeleteDocument(doc.id)}
                            itemName={doc.name}
                            trigger={
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-muted-foreground hover:text-foreground"
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
            <Card>
              <CardHeader>
                <CardTitle>System settings</CardTitle>
                <CardDescription>Configure system-wide settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>System settings will be implemented here</p>
                </div>
              </CardContent>
            </Card>
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
