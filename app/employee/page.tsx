"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense, useCallback, useLayoutEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/lib/badges"
import { saveCurrentTab, getTabFromUrl } from "@/lib/redirect-utils"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppBar } from "@/components/common/app-bar"
import { EmptyState } from "@/components/common/empty-state"
import { GreetingCard } from "@/components/common/greeting-card"
import { useTranslation } from "@/lib/translation-context"
import { formatDateShort } from "@/lib/date-format"
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
  id?: number
  userId?: string
  name?: string
  email?: string
  role?: string
  department?: string
  status?: string
  testScore?: number | null
}

interface Assignment {
  id: string
  name?: string
  title?: string
  description?: string
  moduleId?: string | null
  testId?: string | null
  document?: Document
  test?: Test
  assignedUsers?: AssignedUser[]
  users?: AssignedUser[]
  dueDate?: string | null
  createdAt?: string
  createdBy?: string
  status?: string
}

function EmployeePageInner() {
  const { data: session, status } = useSession()
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  // Initialize assignments from localStorage to prevent empty state on re-mount
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('employee-assignments')
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })
  const [userAssignments, setUserAssignments] = useState<Assignment[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('employee-user-assignments')
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })
  const [currentTab, setCurrentTab] = useState('overview')
  interface TestAttempt {
    id: string
    testId: string
    userId: string
    score?: number | null
    status: string
    completedAt?: string | null
  }
  
  const [testAttempts, setTestAttempts] = useState<TestAttempt[]>([])

  // Load test attempts from API
  const loadTestAttempts = useCallback(async () => {
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
  }, [session?.user?.id])

  // Load assignments from API
  const loadAssignments = useCallback(async (preserveData = false) => {
    try {
      const response = await fetch('/api/assignments', { cache: 'no-store' })
      const result = await response.json()
      
      if (result.success) {
        const allAssignments: Assignment[] = (result.data.assignments || []) as Assignment[]
        setAssignments(allAssignments)
        
        // Save to localStorage for instant display on refresh
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('employee-assignments', JSON.stringify(allAssignments))
          } catch {
            // Ignore localStorage errors
          }
        }
        
        // Filter assignments for current user using the new assignment_users table
        const currentUserId = session?.user?.id
        const filteredUserAssignments = allAssignments.filter((assignment: Assignment) => {
          // Check if this assignment has users array and contains the current user
          if (assignment.users && Array.isArray(assignment.users)) {
            return assignment.users.some((au: AssignedUser) => au.userId === currentUserId)
          }
          return false
        })
        setUserAssignments(filteredUserAssignments)
        
        // Save filtered assignments to localStorage
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('employee-user-assignments', JSON.stringify(filteredUserAssignments))
          } catch {
            // Ignore localStorage errors
          }
        }
      } else {
        console.error('Failed to load assignments:', result.message)
        if (!preserveData) {
          setAssignments([])
          setUserAssignments([])
        }
      }
    } catch (error) {
      console.error('Error loading assignments:', error)
      if (!preserveData) {
        setAssignments([])
        setUserAssignments([])
      }
    }
  }, [session?.user?.id])

  // Track if we've already loaded data to prevent multiple loads
  const hasLoadedDataRef = useRef(false)
  const hasCachedDataOnMountRef = useRef(userAssignments.length > 0)

  // Initial data load - only once on mount
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if (hasLoadedDataRef.current) return
    
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    hasLoadedDataRef.current = true
    
    // Check if we have cached data - if yes, load in background; if no, await load
    const hasCachedData = hasCachedDataOnMountRef.current
    
    if (hasCachedData) {
      // We have cached data, show it immediately and refresh in background
      Promise.all([
        loadAssignments(true),
        loadTestAttempts()
      ]).catch(error => {
        console.error('Error loading employee data:', error)
      })
    } else {
      // No cached data, await the load
      Promise.all([
        loadAssignments(false),
        loadTestAttempts()
      ]).catch(error => {
        console.error('Error loading employee data:', error)
      })
    }
  }, [session, status, router, loadAssignments, loadTestAttempts])

  // Handle tab from URL - only update tab, don't reload data
  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      return
    }

    // Handle tab from URL
    const tabFromUrl = getTabFromUrl(searchParams)
    if (tabFromUrl) {
      setCurrentTab(tabFromUrl)
    }
  }, [session, status, searchParams])

  // Save current tab when it changes
  useEffect(() => {
    if (currentTab) {
      saveCurrentTab('employee', currentTab)
    }
  }, [currentTab])

  // Tab-specific loading - only load what's needed for each tab
  const loadTabData = useCallback(async (tab: string, preserveData = false) => {
    try {
      if (tab === 'overview' || tab === 'assignments') {
        // Overview and assignments tabs only need assignments
        await loadAssignments(preserveData)
      } else if (tab === 'progress') {
        // Progress tab needs both assignments and test attempts
        await Promise.all([
          loadAssignments(preserveData),
          loadTestAttempts()
        ])
      }
    } catch (error) {
      console.error(`Error loading ${tab} tab data:`, error)
    }
  }, [loadAssignments, loadTestAttempts])

  // Load data when tab changes
  useEffect(() => {
    if (currentTab && ['overview', 'assignments', 'progress'].includes(currentTab)) {
      loadTabData(currentTab, true) // Use preserveData=true to avoid flickering
    }
  }, [currentTab, loadTabData])

  // Transform assignment data for display - MUST be before early returns
  const currentUserId = session?.user?.id
  const transformedAssignments = useMemo(() => userAssignments.map(assignment => {
    // Get the user's specific status from assignment_users
    const userAssignment = assignment.users?.find((au: AssignedUser) => au.userId === currentUserId)
    
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
      dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().split('T')[0] : t('noDueDate'),
      description: assignment.description || t('assignmentDescriptionDefault'), // Use actual description or default message
      estimatedTime: assignment.testId ? `15 ${t('minutes')}` : `30 ${t('minutes')}`,
      score: testScore, // Use actual test score from database
      moduleId: assignment.moduleId,
      testId: assignment.testId
    }
  }), [userAssignments, currentUserId, t])

  // Note: Next.js loading.tsx will handle the initial loading state
  if (status === "loading" || !session) {
    return null
  }

  const handleCompleteAssignment = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/complete`, {
        method: 'POST'
      })
      const result = await response.json()
      
      if (result.success) {
        // Optimistically update UI - reload assignments in background
        loadAssignments(true).catch(console.error)
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
      // Prefetch route for instant navigation
      const documentId = String(assignment.moduleId)
      const url = `/read/${documentId}`
      router.prefetch(url)
      
      // Navigate immediately
      router.push(url)
      
      // Update assignment status in background (don't wait for it)
      fetch(`/api/assignments/${assignmentId}/start`, {
        method: 'POST'
      })
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            // Reload assignments in background to get updated data (preserve existing data during load)
            loadAssignments(true).catch(console.error)
          }
        })
        .catch(error => {
          console.error('Error starting assignment:', error)
        })
    }
  }

  const handleTakeTest = (assignmentId: string) => {
    // Find the assignment and get the test ID
    const assignment = userAssignments.find(a => a.id === assignmentId)
    if (assignment && assignment.testId) {
      // Prefetch route for instant navigation
      const url = `/test/${assignment.testId}`
      router.prefetch(url)
      // Navigate to test page using testId
      router.push(url)
    } else if (assignment && assignment.test?.id) {
      // Prefetch route for instant navigation (fallback)
      const url = `/test/${assignment.test.id}`
      router.prefetch(url)
      // Navigate to test page (fallback)
      router.push(url)
    }
  }

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
        return 'bg-primary/20 text-primary-700 dark:text-primary-300'
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

  const userName = session.user?.name || t('employee')

  return (
    <div className="min-h-screen bg-background">
      <AppBar 
        role="employee" 
        user={{
          name: session.user?.name,
          email: session.user?.email,
          image: session.user?.image
        }}
      />

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8">
        <GreetingCard
          name={userName}
        />

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-3 md:space-y-6">
          <div className="tabs-scroll-container">
            <TabsList className="grid w-full min-w-max grid-cols-3">
            <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
            <TabsTrigger value="assignments">{t('assignments')}</TabsTrigger>
            <TabsTrigger value="progress">{t('progress')}</TabsTrigger>
          </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Overall Progress Card - Top */}
            <Card>
              <CardHeader>
                <CardTitle><span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">📈</span> <span className="leading-none self-center">{t('overallProgress')}</span></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>{t('overallCompletion')}</span>
                    <span>{Math.round(totalProgress)}%</span>
                  </div>
                  <Progress value={totalProgress} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    {completedCount} of {assignments.length} {t('assignmentsCompleted')}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('totalAssignments')}</CardTitle>
                  <span className="text-2xl">🎯</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{assignments.length}</div>
                  <p className="text-xs text-muted-foreground">{t('allTime')}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('completed')}</CardTitle>
                  <span className="text-2xl">✅</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{completedCount}</div>
                  <p className="text-xs text-muted-foreground">{t('readyForReview')}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('inProgress')}</CardTitle>
                  <span className="text-2xl">⏱️</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
                  <p className="text-xs text-muted-foreground">{t('keepGoing')}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('pending')}</CardTitle>
                  <span className="text-2xl">⏳</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
                  <p className="text-xs text-muted-foreground">{t('notStarted')}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('failed')}</CardTitle>
                  <span className="text-2xl">❌</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{failedCount}</div>
                  <p className="text-xs text-muted-foreground">Retake required</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="space-y-6">
            {transformedAssignments.length === 0 ? (
              <EmptyState
                icon={<span className="text-5xl">📋</span>}
                title={t('noAssignmentsYet')}
                description={t('youDontHaveAnyAssignmentsAtTheMoment')}
              />
            ) : (
              <div className="grid gap-4">
                {transformedAssignments.map((assignment) => (
                <Card key={assignment.id} className="transition-shadow">
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
                            {assignment.dueDate && (
                              <div className="flex items-center space-x-1">
                                {getStatusIcon(assignment.status)}
                                <span>{t('due')}: {assignment.dueDate}</span>
                              </div>
                            )}
                            <div className="flex items-center space-x-1">
                              <Clock className="h-5 w-5" />
                              <span>{assignment.estimatedTime}</span>
                            </div>
                            {assignment.score && (
                              <div className="flex items-center space-x-1">
                                <BarChart3 className="h-5 w-5" />
                                <span>{t('score')}: {assignment.score}%</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            {(assignment.type === 'both' || assignment.type === 'document') && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleReadDocument(assignment.id)}
                                className="flex-1 min-w-[96px] text-primary border-primary hover:bg-primary hover:text-primary-foreground"
                              >
                                {t('read')}
                              </Button>
                            )}
                            {(assignment.type === 'both' || assignment.type === 'test') && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleTakeTest(assignment.id)}
                                className="flex-1 min-w-[96px] text-primary border-primary hover:bg-primary hover:text-primary-foreground"
                              >
                                {t('test')}
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
                  <CardTitle><span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">📈</span> <span className="leading-none self-center">{t('learningStatistics')}</span></CardTitle>
                  <CardDescription>{t('yourPerformanceAndCompletionRates')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{completedCount}</div>
                      <div className="text-sm text-muted-foreground">{t('completed')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">{inProgressCount}</div>
                      <div className="text-sm text-muted-foreground">{t('inProgress')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
                      <div className="text-sm text-muted-foreground">{t('pending')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">{failedCount}</div>
                      <div className="text-sm text-muted-foreground">{t('failed')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle><span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">🔔</span> <span className="leading-none self-center">{t('recentActivity')}</span></CardTitle>
                  <CardDescription>{t('yourRecentAssignmentActivityAndTestScores')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Show recent assignments with scores */}
                    {transformedAssignments
                      .filter(a => a.score !== undefined && a.score !== null && (a.status === 'completed' || a.status === 'failed'))
                      .sort((a, b) => new Date(b.dueDate || '').getTime() - new Date(a.dueDate || '').getTime())
                      .slice(0, 5)
                      .map((assignment) => {
                        const score = assignment.score ?? 0
                        const colorClass = score >= 70 ? 'text-green-600' : 'text-red-600'
                        return (
                          <div key={assignment.id} className="flex items-center justify-between px-5 py-3 border rounded-3xl hover:bg-accent transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{assignment.title}</h4>
                                <StatusBadge status={assignment.status} />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {assignment.dueDate && `${t('due')}: ${assignment.dueDate}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${colorClass}`}>
                                {score}%
                              </div>
                              <div className="text-xs text-muted-foreground">{t('score')}</div>
                            </div>
                          </div>
                        )
                      })}
                    
                    {/* Show test attempts */}
                    {testAttempts
                      .sort((a, b) => new Date(b.completedAt || '').getTime() - new Date(a.completedAt || '').getTime())
                      .slice(0, 5)
                      .map((attempt) => {
                        const score = attempt.score ?? 0
                        const colorClass = score >= 70 ? 'text-green-600' : 'text-red-600'
                        return (
                          <div key={attempt.id} className="flex items-center justify-between px-5 py-3 border rounded-3xl hover:bg-accent transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{t('testAttempt')}</h4>
                                <StatusBadge status={attempt.status === 'completed' ? 'completed' : 'failed'} />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {attempt.completedAt && `${t('completed')}: ${formatDateShort(attempt.completedAt)}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${colorClass}`}>
                                {score}%
                              </div>
                              <div className="text-xs text-muted-foreground">{t('score')}</div>
                            </div>
                          </div>
                        )
                      })}
                    
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

export default function EmployeePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div></div>}>
      <EmployeePageInner />
    </Suspense>
  )
}
