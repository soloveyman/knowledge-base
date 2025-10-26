"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/lib/badges"
import { saveCurrentTab, getTabFromUrl } from "@/lib/redirect-utils"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppBar } from "@/components/common/app-bar"
import { EmptyState } from "@/components/common/empty-state"
import { 
  BookOpen, 
  ClipboardList, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Target,
  BarChart3
} from "lucide-react"

interface Document {
  id: number
  name: string
  type: string
  uploadedAt: string
}

interface Test {
  id: string
  title: string
  questionCount: number
}

interface AssignedUser {
  id: number
  name: string
  email: string
  role: string
  department: string
}

interface Assignment {
  id: string
  name: string
  description: string
  document: Document
  test: Test
  assignedUsers: AssignedUser[]
  dueDate: string
  createdAt: string
  createdBy: string
  status: string
}

export default function EmployeePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [userAssignments, setUserAssignments] = useState<Assignment[]>([])
  const [currentTab, setCurrentTab] = useState('overview')
  const [testAttempts, setTestAttempts] = useState<any[]>([])

  // Load test attempts from API
  const loadTestAttempts = async () => {
    try {
      const response = await fetch(`/api/test-attempts?userId=${session?.user?.id}`)
      const result = await response.json()
      
      if (result.success) {
        setTestAttempts(result.data.attempts || [])
      }
    } catch (error) {
      console.error('Error loading test attempts:', error)
      setTestAttempts([])
    }
  }

  // Load assignments from API
  const loadAssignments = async () => {
    try {
      const response = await fetch('/api/assignments')
      const result = await response.json()
      
      if (result.success) {
        const allAssignments = result.data.assignments
        setAssignments(allAssignments)
        
        // Filter assignments for current user using the new assignment_users table
        const currentUserId = session?.user?.id
        const userAssignments = allAssignments.filter((assignment: any) => {
          // Check if this assignment has users array and contains the current user
          if (assignment.users && Array.isArray(assignment.users)) {
            return assignment.users.some((au: any) => au.userId === currentUserId)
          }
          return false
        })
        setUserAssignments(userAssignments)
      } else {
        console.error('Failed to load assignments:', result.message)
        setAssignments([])
        setUserAssignments([])
      }
    } catch (error) {
      console.error('Error loading assignments:', error)
      setAssignments([])
      setUserAssignments([])
    }
  }

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Handle tab from URL
    const tabFromUrl = getTabFromUrl(searchParams)
    if (tabFromUrl) {
      setCurrentTab(tabFromUrl)
    }

    // Load assignments from API
    loadAssignments()
    
    // Load test attempts
    loadTestAttempts()

    // Role-based redirects are now handled by middleware
  }, [session, status, router, searchParams])

  // Save current tab when it changes
  useEffect(() => {
    if (currentTab) {
      saveCurrentTab('employee', currentTab)
    }
  }, [currentTab])

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


  const handleCompleteAssignment = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/complete`, {
        method: 'POST'
      })
      const result = await response.json()
      
      if (result.success) {
        // Reload assignments to get updated data
        await loadAssignments()
      } else {
        console.error('Failed to complete assignment:', result.message)
      }
    } catch (error) {
      console.error('Error completing assignment:', error)
    }
  }

  const handleReadDocument = async (assignmentId: string) => {
    // Find the assignment and get the document info
    const assignment = userAssignments.find(a => a.id === assignmentId)
    if (assignment && assignment.moduleId) {
      try {
        // Update assignment status to in_progress when user starts reading
        const response = await fetch(`/api/assignments/${assignmentId}/start`, {
          method: 'POST'
        })
        const result = await response.json()
        
        if (result.success) {
          // Reload assignments to get updated data
          await loadAssignments()
        }
      } catch (error) {
        console.error('Error starting assignment:', error)
      }
      
      // Find the document that has this moduleId
      try {
        const docsResponse = await fetch('/api/documents')
        const docsResult = await docsResponse.json()
        if (docsResult.success && docsResult.data.documents) {
          const document = docsResult.data.documents.find((d: any) => d.moduleId === assignment.moduleId)
          if (document) {
            // Navigate to document reader
            router.push(`/read/${document.id}`)
          }
        }
      } catch (error) {
        console.error('Error finding document:', error)
      }
    }
  }

  const handleTakeTest = (assignmentId: string) => {
    // Find the assignment and get the test ID
    const assignment = userAssignments.find(a => a.id === assignmentId)
    if (assignment && assignment.testId) {
      // Navigate to test page using testId
      router.push(`/test/${assignment.testId}`)
    }
  }

  // Transform assignment data for display
  const transformedAssignments = userAssignments.map(assignment => {
    // Get the user's specific status from assignment_users
    const currentUserId = session?.user?.id
    const userAssignment = assignment.users?.find((au: any) => au.userId === currentUserId)
    
    // Get the actual test score from the user assignment data
    const testScore = userAssignment?.testScore
    
    // If there's a test score, check if it's below 70% to mark as failed
    let userStatus = userAssignment?.status || assignment.status || 'pending'
    if (testScore !== undefined && testScore !== null) {
      if (testScore < 70) {
        userStatus = 'failed'
      } else if (testScore >= 70 && userStatus === 'completed') {
        userStatus = 'completed'
      }
    }
    
    // Determine type: if both moduleId and testId exist, it's "both"
    let type = "document"
    if (assignment.moduleId && assignment.testId) {
      type = "both"
    } else if (assignment.testId) {
      type = "test"
    } else if (assignment.moduleId) {
      type = "document"
    }
    
    return {
      id: assignment.id,
      title: assignment.title || `Assignment ${assignment.id.slice(0, 8)}`, // Use custom title or ID as fallback
      type: type,
      status: userStatus,
      progress: userStatus === 'completed' ? 100 : 0,
      dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().split('T')[0] : 'No due date',
      description: assignment.description || `Complete assignment ${assignment.id.slice(0, 8)}`, // Use actual description or generate
      estimatedTime: assignment.testId ? "15 min" : "30 min",
      score: testScore, // Use actual test score from database
      moduleId: assignment.moduleId,
      testId: assignment.testId
    }
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-500" />
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-600 dark:text-green-400'
      case 'failed':
        return 'bg-red-500/20 text-red-600 dark:text-red-400'
      case 'in_progress':
        return 'bg-primary/20 text-primary-foreground'
      case 'pending':
        return 'bg-destructive/20 text-destructive-foreground'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const completedCount = transformedAssignments.filter(a => a.status === 'completed').length
  const failedCount = transformedAssignments.filter(a => a.status === 'failed').length
  const inProgressCount = transformedAssignments.filter(a => a.status === 'in_progress').length
  const pendingCount = transformedAssignments.filter(a => a.status === 'pending').length
  const totalProgress = transformedAssignments.length > 0 
    ? transformedAssignments.reduce((acc, a) => acc + a.progress, 0) / transformedAssignments.length 
    : 0

  return (
    <div className="min-h-screen bg-background">
      <AppBar role="employee" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2">
            Welcome back, {session.user?.name || 'Employee'}!
          </h2>
          <p className="text-muted-foreground">
            Your learning journey and assignment management
          </p>
        </div>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assignments">My Assignments</TabsTrigger>
            <TabsTrigger value="progress">My Progress</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Overall Progress Card - Top */}
            <Card>
              <CardHeader>
                <CardTitle>Overall Progress</CardTitle>
                <CardDescription>Your learning journey progress</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Overall Completion</span>
                    <span>{Math.round(totalProgress)}%</span>
                  </div>
                  <Progress value={totalProgress} className="h-3" />
                  <div className="text-xs text-muted-foreground">
                    {completedCount} of {assignments.length} assignments completed
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{assignments.length}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{completedCount}</div>
                  <p className="text-xs text-muted-foreground">Ready for review</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                  <Clock className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
                  <p className="text-xs text-muted-foreground">Keep going!</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
                  <p className="text-xs text-muted-foreground">Not started</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{failedCount}</div>
                  <p className="text-xs text-muted-foreground">Need retake</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="space-y-6">
            {transformedAssignments.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-12 w-12" />}
                title="No assignments yet"
                description="You don't have any assignments at the moment. Check back later or contact your manager if you're expecting assignments."
              />
            ) : (
              <div className="grid gap-4">
                {transformedAssignments.map((assignment) => (
                <Card key={assignment.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-3 md:p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {assignment.type === 'document' ? (
                            <BookOpen className="h-5 w-5 text-blue-500" />
                          ) : (
                            <ClipboardList className="h-5 w-5 text-purple-500" />
                          )}
                          <h3 className="text-lg font-semibold text-foreground dark:text-white">
                            {assignment.title}
                          </h3>
                          <StatusBadge status={assignment.status} />
                        </div>
                        
                        <p className="text-muted-foreground mb-4">
                          {assignment.description}
                        </p>
                        
                        
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(assignment.status)}
                              <span>Due: {assignment.dueDate}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-5 w-5" />
                              <span>{assignment.estimatedTime}</span>
                            </div>
                            {assignment.score && (
                              <div className="flex items-center space-x-1">
                                <BarChart3 className="h-5 w-5" />
                                <span>Score: {assignment.score}%</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            {(assignment.type === 'both' || assignment.type === 'document') && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleReadDocument(assignment.id)}
                                className="flex-1 text-primary border-primary hover:bg-primary hover:text-primary-foreground"
                              >
                                Read
                              </Button>
                            )}
                            {(assignment.type === 'both' || assignment.type === 'test') && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleTakeTest(assignment.id)}
                                className="flex-1 text-primary border-primary hover:bg-primary hover:text-primary-foreground"
                              >
                                Test
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-3 md:space-y-6">
            <div className="grid gap-3 md:gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Learning Statistics</CardTitle>
                  <CardDescription>Your performance and completion rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{completedCount}</div>
                      <div className="text-sm text-muted-foreground">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">{inProgressCount}</div>
                      <div className="text-sm text-muted-foreground">In Progress</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
                      <div className="text-sm text-muted-foreground">Pending</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">{failedCount}</div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your recent assignment activity and test scores</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Show recent assignments with scores */}
                    {transformedAssignments
                      .filter(a => a.score !== undefined && a.score !== null && (a.status === 'completed' || a.status === 'failed'))
                      .sort((a, b) => new Date(b.dueDate || '').getTime() - new Date(a.dueDate || '').getTime())
                      .slice(0, 5)
                      .map((assignment) => (
                        <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{assignment.title}</h4>
                              <StatusBadge status={assignment.status} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {assignment.dueDate && `Due: ${assignment.dueDate}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${assignment.score >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                              {assignment.score}%
                            </div>
                            <div className="text-xs text-muted-foreground">Score</div>
                          </div>
                        </div>
                      ))}
                    
                    {/* Show test attempts */}
                    {testAttempts
                      .sort((a, b) => new Date(b.completedAt || '').getTime() - new Date(a.completedAt || '').getTime())
                      .slice(0, 5)
                      .map((attempt) => (
                        <div key={attempt.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">Test Attempt</h4>
                              <StatusBadge status={attempt.status === 'completed' ? 'completed' : 'failed'} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {attempt.completedAt && `Completed: ${new Date(attempt.completedAt).toLocaleDateString()}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${attempt.score >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                              {attempt.score}%
                            </div>
                            <div className="text-xs text-muted-foreground">Score</div>
                          </div>
                        </div>
                      ))}
                    
                    {transformedAssignments.filter(a => a.score !== undefined && a.score !== null).length === 0 && testAttempts.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No recent activity yet.</p>
                        <p className="text-sm mt-2">Complete assignments to see your progress here.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
