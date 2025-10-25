"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UsersPage } from "@/components/pages/users-page"
import { 
  Users, 
  FileText, 
  ClipboardList, 
  BarChart3, 
  LogOut,
  Settings,
  Crown
} from "lucide-react"
import { signOut } from "next-auth/react"

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

interface SavedAssignment {
  id: string
  name: string
  description: string
  document: any
  test: any
  assignedUsers: any[]
  dueDate: string
  createdAt: string
  createdBy: string
  status: string
}

interface SavedDocument {
  id: string
  name: string
  type: string
  uploadedAt: string
}

export default function OwnerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [savedUsers, setSavedUsers] = useState<SavedUser[]>([])
  const [savedAssignments, setSavedAssignments] = useState<SavedAssignment[]>([])
  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>([])
  const [savedTests, setSavedTests] = useState<any[]>([])

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Load data from localStorage
    if (typeof window !== 'undefined') {
      const users = JSON.parse(localStorage.getItem('savedUsers') || '[]')
      const assignments = JSON.parse(localStorage.getItem('savedAssignments') || '[]')
      const documents = JSON.parse(localStorage.getItem('savedDocuments') || '[]')
      const tests = JSON.parse(localStorage.getItem('savedTests') || '[]')
      
      // Initialize with some sample documents if none exist
      if (documents.length === 0) {
        const sampleDocuments = [
          { id: "1", name: "Employee Handbook.docx", type: "DOCX", uploadedAt: "2 hours ago" },
          { id: "2", name: "Training Schedule.xlsx", type: "XLSX", uploadedAt: "1 day ago" },
          { id: "3", name: "Safety Guidelines.docx", type: "DOCX", uploadedAt: "3 days ago" }
        ]
        localStorage.setItem('savedDocuments', JSON.stringify(sampleDocuments))
        setSavedDocuments(sampleDocuments)
      } else {
        setSavedDocuments(documents)
      }
      
      setSavedUsers(users)
      setSavedAssignments(assignments)
      setSavedTests(tests)
    }

    // Role-based redirects are now handled by middleware
  }, [session, status, router])

  // User handlers
  const handleDeleteUser = (id: string) => {
    const updatedUsers = savedUsers.filter(u => u.id !== id)
    setSavedUsers(updatedUsers)
    localStorage.setItem('savedUsers', JSON.stringify(updatedUsers))
  }

  const handleViewUser = (id: string) => {
    console.log('View user:', id)
  }

  const handleEditUser = (id: string) => {
    // Store the user ID for editing and redirect to user builder
    localStorage.setItem('editingUserId', id)
    router.push('/user-builder')
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: "/auth/signin" })
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
              <Crown className="h-8 w-8 text-yellow-600 mr-3 shrink-0" />
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Owner Dashboard</h1>
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
            Welcome back, {session.user?.name || 'Owner'}!
          </h2>
          <p className="text-gray-600">
            Full system control and business management
          </p>
        </div>


        {/* Main Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="w-full min-w-max">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
              <TabsTrigger value="users" className="text-xs sm:text-sm">Users</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            {/* Overview Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{savedUsers.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {savedUsers.filter(u => u.role === 'manager').length} managers, {savedUsers.filter(u => u.role === 'employee').length} employees
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Training</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{savedAssignments.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {savedAssignments.filter(a => a.status === 'active').length} active, {savedAssignments.filter(a => a.status === 'completed').length} completed
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Documents</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{savedDocuments.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {savedDocuments.filter(d => d.type === 'DOCX').length} DOCX, {savedDocuments.filter(d => d.type === 'XLSX').length} XLSX
                  </p>
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

            <Card>
              <CardHeader>
                <CardTitle>Reports & Analytics</CardTitle>
                <CardDescription>Comprehensive system analytics and reporting</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Advanced reporting features will be implemented here</p>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UsersPage
              users={savedUsers}
              onDeleteUser={handleDeleteUser}
              onViewUser={handleViewUser}
              onEditUser={handleEditUser}
            />
          </TabsContent>


          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>Configure system-wide settings and preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
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
