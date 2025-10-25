"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useMemo, useLayoutEffect } from "react"
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
  const [savedTests, setSavedTests] = useState<SavedTest[]>([])
  const [savedAssignments, setSavedAssignments] = useState<SavedAssignment[]>([])
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
  
  const [documents, setDocuments] = useState<Array<{
    id: string
    name: string
    type: string
    uploadedAt: string
  }>>([])
  
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
  const loadData = async () => {
    try {
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
        setSavedAssignments(assignmentsResult.data.assignments)
      }

      // Load tests
      const testsResponse = await fetch('/api/tests')
      const testsResult = await testsResponse.json()
      if (testsResult.success) {
        setSavedTests(testsResult.data.tests)
      }

      // Load documents
      const documentsResponse = await fetch('/api/documents')
      const documentsResult = await documentsResponse.json()
      if (documentsResult.success) {
        setDocuments(documentsResult.data.documents)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  useLayoutEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    loadData()
  }, [])


  // Document handlers
  const handleDeleteDocument = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      
      if (result.success) {
        setDocuments(prev => prev.filter(doc => doc.id !== id))
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
    router.push(`/docs/${encodeURIComponent(name)}`)
  }

  const handleImportDocument = () => {
    router.push('/docs/import')
  }

  // Test handlers
  const handleDeleteTest = (id: string) => {
    const updatedTests = savedTests.filter(t => t.id !== id)
    setSavedTests(updatedTests)
    localStorage.setItem('savedTests', JSON.stringify(updatedTests))
  }

  const handleViewTest = (id: string) => {
    console.log('Open test:', id)
  }

  const handleEditTest = (id: string) => {
    // Store the test ID for editing and redirect to test builder
    localStorage.setItem('editingTestId', id)
    router.push('/test-builder')
  }

  // Assignment handlers
  const handleDeleteAssignment = (id: string) => {
    const updatedAssignments = savedAssignments.filter(a => a.id !== id)
    setSavedAssignments(updatedAssignments)
    localStorage.setItem('savedAssignments', JSON.stringify(updatedAssignments))
  }

  const handleViewAssignment = (id: string) => {
    console.log('Open assignment:', id)
  }

  const handleEditAssignment = (id: string) => {
    // Store the assignment ID for editing and redirect to assignment builder
    localStorage.setItem('editingAssignmentId', id)
    router.push('/assignment-builder')
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
                {documents.length === 0 ? (
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
            />
          </TabsContent>

          <TabsContent value="assignments" className="space-y-6">
            <AssignmentsPage
              assignments={savedAssignments}
              onDeleteAssignment={handleDeleteAssignment}
              onViewAssignment={handleViewAssignment}
              onEditAssignment={handleEditAssignment}
            />
          </TabsContent>

        </Tabs>
      </main>
    </div>
  )
}
