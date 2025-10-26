"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UsersPage } from "@/components/pages/users-page"
import { AppBar } from "@/components/common/app-bar"
import UserProgressReport from "@/components/reports/user-progress-report"
import { 
  Users, 
  FileText, 
  ClipboardList, 
  BarChart3, 
  Settings
} from "lucide-react"

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
  document: unknown
  test: unknown
  assignedUsers: unknown[]
  dueDate: string
  createdAt: string
  createdBy: string
  status: string
  testScore?: number
  users?: Array<{ userId: string; status: string; testScore?: number }>
  moduleId?: string
  testId?: string
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

  // Load data from APIs
  const loadData = useCallback(async () => {
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

      // Load documents
      const documentsResponse = await fetch('/api/documents')
      const documentsResult = await documentsResponse.json()
      if (documentsResult.success) {
        setSavedDocuments(documentsResult.data.documents)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }, [])

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Load data from APIs
    const fetchData = async () => {
      await loadData()
    }
    fetchData()

    // Role-based redirects are now handled by middleware
  }, [session, status, router, loadData])

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
    // Redirect to user builder with edit parameter
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
      <AppBar role="owner" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2">
            Welcome back, {session.user?.name || 'Owner'}!
          </h2>
          <p className="text-muted-foreground">
            Full system control and business management
          </p>
        </div>


        {/* Main Tabs */}
        <Tabs defaultValue="overview" className="space-y-3 md:space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="w-full min-w-max">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
              <TabsTrigger value="users" className="text-xs sm:text-sm">Users</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-3 md:space-y-6">
            {/* Overview Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
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
                  <div className="text-2xl font-bold">{(() => {
                    let totalUserAssignments = 0
                    savedAssignments.forEach(assignment => {
                      if (assignment.users && Array.isArray(assignment.users)) {
                        totalUserAssignments += assignment.users.length
                      }
                    })
                    return totalUserAssignments
                  })()}</div>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      let activeCount = 0
                      let completedCount = 0
                      savedAssignments.forEach(assignment => {
                        if (assignment.users && Array.isArray(assignment.users)) {
                          assignment.users.forEach((au: { userId: string; status: string; testScore?: number }) => {
                            if (au.status === 'in_progress' || au.status === 'pending') activeCount++
                            if (au.status === 'completed') completedCount++
                          })
                        }
                      })
                      return `${activeCount} active, ${completedCount} completed`
                    })()}
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
                    {(() => {
                      let totalUserAssignments = 0
                      let completedUserAssignments = 0
                      
                      savedAssignments.forEach(assignment => {
                        if (assignment.users && Array.isArray(assignment.users)) {
                          assignment.users.forEach((au: { userId: string; status: string; testScore?: number }) => {
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
                          assignment.users.forEach((au: { userId: string; status: string; testScore?: number }) => {
                            totalUserAssignments++
                            if (au.status === 'completed') {
                              completedUserAssignments++
                            }
                          })
                        }
                      })
                      
                      return `${completedUserAssignments} of ${totalUserAssignments} completed`
                    })()}
                  </p>
                </CardContent>
              </Card>
            </div>

            <UserProgressReport 
              users={savedUsers} 
              assignments={savedAssignments as SavedAssignment[] & { users?: Array<{ userId: string; status: string; testScore?: number }> }[]}
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


          <TabsContent value="settings" className="space-y-3 md:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>Configure system-wide settings and preferences</CardDescription>
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
