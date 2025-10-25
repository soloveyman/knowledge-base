"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  BookOpen, 
  ClipboardList, 
  Clock, 
  CheckCircle,
  AlertCircle,
  LogOut,
  Building2,
  Target,
  BarChart3
} from "lucide-react"
import { signOut } from "next-auth/react"

interface Assignment {
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

export default function EmployeePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [userAssignments, setUserAssignments] = useState<Assignment[]>([])

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Load assignments from localStorage
    if (typeof window !== 'undefined') {
      const savedAssignments = JSON.parse(localStorage.getItem('savedAssignments') || '[]')
      setAssignments(savedAssignments)
      
      // Filter assignments for current user
      const currentUserEmail = session.user?.email
      const userAssignments = savedAssignments.filter((assignment: Assignment) => 
        assignment.assignedUsers.some((user: any) => user.email === currentUserEmail)
      )
      setUserAssignments(userAssignments)
    }

    // Role-based redirects are now handled by middleware
  }, [session, status, router])

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

  const handleSignOut = () => {
    signOut({ callbackUrl: "/auth/signin" })
  }

  const handleCompleteAssignment = (assignmentId: string) => {
    const updatedAssignments = assignments.map(assignment => 
      assignment.id === assignmentId 
        ? { ...assignment, status: 'completed' }
        : assignment
    )
    setAssignments(updatedAssignments)
    localStorage.setItem('savedAssignments', JSON.stringify(updatedAssignments))
    
    // Update user assignments
    const updatedUserAssignments = updatedAssignments.filter((assignment: Assignment) => 
      assignment.assignedUsers.some((user: any) => user.email === session?.user?.email)
    )
    setUserAssignments(updatedUserAssignments)
  }

  // Transform assignment data for display
  const transformedAssignments = userAssignments.map(assignment => ({
    id: assignment.id,
    title: assignment.name,
    type: assignment.test ? "test" : "document",
    status: assignment.status === 'active' ? 'pending' : assignment.status,
    progress: assignment.status === 'completed' ? 100 : 0,
    dueDate: new Date(assignment.dueDate).toISOString().split('T')[0],
    description: assignment.description || `Complete ${assignment.test ? 'test' : 'document review'}`,
    estimatedTime: assignment.test ? "15 min" : "30 min",
    score: assignment.status === 'completed' ? Math.floor(Math.random() * 20) + 80 : undefined
  }))

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-500" />
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const completedCount = transformedAssignments.filter(a => a.status === 'completed').length
  const inProgressCount = transformedAssignments.filter(a => a.status === 'in_progress').length
  const pendingCount = transformedAssignments.filter(a => a.status === 'pending').length
  const totalProgress = transformedAssignments.length > 0 
    ? transformedAssignments.reduce((acc, a) => acc + a.progress, 0) / transformedAssignments.length 
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  My Learning Dashboard
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {session.user?.businessName} • Welcome back, {session.user?.name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assignments">My Assignments</TabsTrigger>
            <TabsTrigger value="progress">My Progress</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your latest learning activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Completed Company Policies Review</p>
                        <p className="text-xs text-muted-foreground">2 days ago</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Started Safety Procedures Training</p>
                        <p className="text-xs text-muted-foreground">1 week ago</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Passed Data Security Awareness (85%)</p>
                        <p className="text-xs text-muted-foreground">2 weeks ago</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">My Assignments</h2>
              <div className="text-sm text-muted-foreground">
                {inProgressCount} in progress, {pendingCount} pending
              </div>
            </div>
            
            <div className="grid gap-4">
              {transformedAssignments.map((assignment) => (
                <Card key={assignment.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {assignment.type === 'document' ? (
                            <BookOpen className="h-5 w-5 text-blue-500" />
                          ) : (
                            <ClipboardList className="h-5 w-5 text-purple-500" />
                          )}
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {assignment.title}
                          </h3>
                          <Badge className={getStatusColor(assignment.status)}>
                            {assignment.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          {assignment.description}
                        </p>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{assignment.progress}%</span>
                          </div>
                          <Progress value={assignment.progress} className="h-2" />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(assignment.status)}
                              <span>Due: {assignment.dueDate}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>{assignment.estimatedTime}</span>
                            </div>
                            {assignment.score && (
                              <div className="flex items-center space-x-1">
                                <BarChart3 className="h-4 w-4" />
                                <span>Score: {assignment.score}%</span>
                              </div>
                            )}
                          </div>
                          
                          <Button 
                            size="sm" 
                            disabled={assignment.status === 'completed'}
                            onClick={() => handleCompleteAssignment(assignment.id)}
                          >
                            {assignment.status === 'completed' ? 'Completed' : 
                             assignment.status === 'in_progress' ? 'Continue' : 'Start'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-6">
            <h2 className="text-2xl font-semibold">My Progress</h2>
            
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Learning Statistics</CardTitle>
                  <CardDescription>Your performance and completion rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{completedCount}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">{inProgressCount}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">In Progress</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Test Results</CardTitle>
                  <CardDescription>Your test scores and performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {transformedAssignments.filter(a => a.type === 'test' && a.score).map((test) => (
                      <div key={test.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h4 className="font-medium">{test.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Completed on {test.dueDate}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">{test.score}%</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Score</div>
                        </div>
                      </div>
                    ))}
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
