"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useMemo, useLayoutEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Users, 
  ClipboardList, 
  BarChart3, 
  LogOut,
  Building2,
  FileText,
  X
} from "lucide-react"
import { signOut } from "next-auth/react"
import { TestsPage } from "@/components/pages/tests-page"
import { AssignmentsPage } from "@/components/pages/assignments-page"
import { DeleteConfirmation } from "@/components/common/delete-confirmation"

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
  
  // Mock documents data - default documents
  const defaultDocuments = useMemo(() => [
    { id: "1", name: "Ланч меню BS.docx", type: "DOCX", uploadedAt: "2 hours ago" },
    { id: "2", name: "Training Schedule.xlsx", type: "XLSX", uploadedAt: "1 day ago" },
    { id: "3", name: "Employee Handbook.docx", type: "DOCX", uploadedAt: "5 minutes ago" },
    { id: "4", name: "Safety Guidelines.pdf", type: "PDF", uploadedAt: "1 hour ago" }
  ], [])
  
  const [mockDocuments, setMockDocuments] = useState(defaultDocuments)
  
  // Get initial tab from URL parameter using useMemo to prevent re-renders
  const defaultTab = useMemo(() => {
    const tab = searchParams.get('tab')
    return tab && ['overview', 'docs', 'tests', 'assignments'].includes(tab) ? tab : "overview"
  }, [searchParams])

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Role-based redirects are now handled by middleware
  }, [session, status, router])

  useLayoutEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    // Load saved tests from localStorage
    const tests = JSON.parse(localStorage.getItem('savedTests') || '[]')
    setTimeout(() => setSavedTests(tests), 0)
    
    // Load saved assignments from localStorage
    const assignments = JSON.parse(localStorage.getItem('savedAssignments') || '[]')
    setTimeout(() => setSavedAssignments(assignments), 0)
    
    // Initialize documents in localStorage if not exists
    const existingDocs = localStorage.getItem('savedDocuments')
    if (!existingDocs) {
      localStorage.setItem('savedDocuments', JSON.stringify(defaultDocuments))
    } else {
      // Load existing documents from localStorage
      const docs = JSON.parse(existingDocs)
      setTimeout(() => setMockDocuments(docs), 0)
    }
  }, [defaultDocuments])

  const handleSignOut = () => {
    signOut({ callbackUrl: "/auth/signin" })
  }

  // Document handlers
  const handleDeleteDocument = (id: string) => {
    const updatedDocuments = mockDocuments.filter(doc => doc.id !== id)
    setMockDocuments(updatedDocuments)
    
    // Update localStorage to keep it in sync
    localStorage.setItem('savedDocuments', JSON.stringify(updatedDocuments))
    
    console.log('Deleted document:', id)
    // Ensure we stay on the docs tab after deletion
    router.push('/manager?tab=docs')
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
              <Building2 className="h-8 w-8 text-blue-600 mr-3 shrink-0" />
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Manager Dashboard</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button variant="outline" size="sm" onClick={handleSignOut} className="text-xs sm:text-sm">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

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
                  <div className="text-2xl font-bold">24</div>
                  <p className="text-xs text-muted-foreground">+2 from last month</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Training</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                  <p className="text-xs text-muted-foreground">3 completed this week</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Documents</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">156</div>
                  <p className="text-xs text-muted-foreground">+12 this month</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">87%</div>
                  <p className="text-xs text-muted-foreground">+5% from last month</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Reports & Analytics</CardTitle>
                <CardDescription>Track training progress and performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Reporting features will be implemented here</p>
                </div>
              </CardContent>
            </Card>

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
                <div className="space-y-3">
                  {mockDocuments.map((doc) => (
                    <div 
                      key={doc.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleViewDocument(doc.name)}
                    >
                      <div>
                        <h3 className="font-medium text-gray-900">{doc.name}</h3>
                        <p className="text-sm text-gray-500">{doc.type} • Uploaded {doc.uploadedAt}</p>
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
