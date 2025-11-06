"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/lib/badges"
import { saveCurrentTab, getTabFromUrl, getPreviousTab } from "@/lib/redirect-utils"
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

export interface Document {
  id: number
  name: string
  type: string
  uploadedAt: string
}

export interface Test {
  id: string
  title: string
  questionCount: number
}

export interface AssignedUser {
  id?: number
  userId?: string
  name?: string
  email?: string
  role?: string
  department?: string
  status?: string
  testScore?: number | null
}

export interface Assignment {
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

export interface TestAttempt {
  id: string
  testId: string
  userId: string
  score?: number | null
  status: string
  completedAt?: string | null
}

interface EmployeePageClientProps {
  initialAssignments: Assignment[]
  initialTestAttempts: TestAttempt[]
  userId: string
  userName?: string
  userEmail?: string
  userImage?: string
}

export function EmployeePageClient({
  initialAssignments,
  initialTestAttempts,
  userId,
  userName,
  userEmail,
  userImage
}: EmployeePageClientProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments)
  const [userAssignments, setUserAssignments] = useState<Assignment[]>(initialAssignments)
  const [testAttempts, setTestAttempts] = useState<TestAttempt[]>(initialTestAttempts)
  
  // Get initial tab from URL parameter or sessionStorage
  const defaultTab = useMemo(() => {
    const tabFromUrl = getTabFromUrl(searchParams)
    if (tabFromUrl && ['overview', 'assignments', 'progress'].includes(tabFromUrl)) {
      return tabFromUrl
    }
    const previousTab = getPreviousTab('employee')
    if (previousTab && ['overview', 'assignments', 'progress'].includes(previousTab)) {
      return previousTab
    }
    return "overview"
  }, [searchParams])

  // Restore tab from sessionStorage on mount if not in URL
  useEffect(() => {
    const tabFromUrl = getTabFromUrl(searchParams)
    if (!tabFromUrl) {
      const previousTab = getPreviousTab('employee')
      if (previousTab && previousTab !== 'overview' && ['overview', 'assignments', 'progress'].includes(previousTab)) {
        router.replace(`/employee?tab=${previousTab}`, { scroll: false })
      }
    }
  }, [searchParams, router])

  // Save current tab when it changes
  useEffect(() => {
    if (defaultTab) {
      saveCurrentTab('employee', defaultTab)
    }
  }, [defaultTab])

  // Load assignments from API
  const loadAssignments = useCallback(async (preserveData = false) => {
    try {
      const response = await fetch('/api/assignments', { cache: 'no-store' })
      const result = await response.json()
      
      if (result.success) {
        const allAssignments: Assignment[] = (result.data.assignments || []) as Assignment[]
        setAssignments(allAssignments)
        
        // Filter assignments for current user using the new assignment_users table
        const filteredUserAssignments = allAssignments.filter((assignment: Assignment) => {
          if (assignment.users && Array.isArray(assignment.users)) {
            return assignment.users.some((au: AssignedUser) => au.userId === userId)
          }
          return false
        })
        setUserAssignments(filteredUserAssignments)
      } else {
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
  }, [userId])

  // Load test attempts from API
  const loadTestAttempts = useCallback(async () => {
    try {
      const response = await fetch(`/api/test-attempts?userId=${userId}`)
      const result = await response.json()
      
      if (result.success) {
        setTestAttempts(result.data.attempts || [])
      }
    } catch (error) {
      console.error('Error loading test attempts:', error)
      setTestAttempts([])
    }
  }, [userId])

  // Reload data when tab changes if data is missing
  useEffect(() => {
    if (defaultTab === 'assignments' && userAssignments.length === 0) {
      loadAssignments(false)
    } else if (defaultTab === 'progress' && (userAssignments.length === 0 || testAttempts.length === 0)) {
      loadAssignments(false)
      loadTestAttempts()
    } else if (defaultTab === 'overview' && userAssignments.length === 0) {
      loadAssignments(false)
      loadTestAttempts()
    }
  }, [defaultTab, loadAssignments, loadTestAttempts, userAssignments.length, testAttempts.length])

  // Reload data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && (defaultTab === 'assignments' || defaultTab === 'progress' || defaultTab === 'overview')) {
        setTimeout(() => {
          loadAssignments(true)
          loadTestAttempts()
        }, 0)
      }
    }

    const handleFocus = () => {
      if (defaultTab === 'assignments' || defaultTab === 'progress' || defaultTab === 'overview') {
        setTimeout(() => {
          loadAssignments(true)
          loadTestAttempts()
        }, 0)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [defaultTab, loadAssignments, loadTestAttempts])

  // Transform assignment data for display
  const transformedAssignments = useMemo(() => userAssignments.map(assignment => {
    const userAssignment = assignment.users?.find((au: AssignedUser) => au.userId === userId)
    
    const testScore = userAssignment?.testScore
    
    let userStatus = userAssignment?.status || assignment.status || 'pending'
    if (testScore !== undefined && testScore !== null) {
      if (testScore < 70) {
        userStatus = 'failed'
      } else if (testScore >= 70 && userStatus === 'completed') {
        userStatus = 'completed'
      }
    }
    
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
      title: assignment.title || `Assignment ${assignment.id.slice(0, 8)}`,
      type: type,
      status: userStatus,
      progress: userStatus === 'completed' ? 100 : 0,
      dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().split('T')[0] : t('noDueDate'),
      description: assignment.description || t('assignmentDescriptionDefault'),
      estimatedTime: assignment.testId ? `15 ${t('minutes')}` : `30 ${t('minutes')}`,
      score: testScore,
      moduleId: assignment.moduleId,
      testId: assignment.testId
    }
  }), [userAssignments, userId, t])

  const handleCompleteAssignment = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/complete`, {
        method: 'POST'
      })
      const result = await response.json()
      
      if (result.success) {
        loadAssignments(true).catch(console.error)
      } else {
        console.error('Failed to complete assignment:', result.message)
      }
    } catch (error) {
      console.error('Error completing assignment:', error)
    }
  }

  const handleReadDocument = async (assignmentId: string) => {
    const assignment = userAssignments.find(a => a.id === assignmentId)
    if (assignment && assignment.moduleId) {
      const documentId = String(assignment.moduleId)
      const url = `/read/${documentId}`
      router.prefetch(url)
      router.push(url)
      
      fetch(`/api/assignments/${assignmentId}/start`, {
        method: 'POST'
      })
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            loadAssignments(true).catch(console.error)
          }
        })
        .catch(error => {
          console.error('Error starting assignment:', error)
        })
    }
  }

  const handleTakeTest = (assignmentId: string) => {
    const assignment = userAssignments.find(a => a.id === assignmentId)
    if (assignment && assignment.testId) {
      const url = `/test/${assignment.testId}`
      router.prefetch(url)
      router.push(url)
    } else if (assignment && assignment.test?.id) {
      const url = `/test/${assignment.test.id}`
      router.prefetch(url)
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

  const completedCount = transformedAssignments.filter(a => a.status === 'completed').length
  const failedCount = transformedAssignments.filter(a => a.status === 'failed').length
  const inProgressCount = transformedAssignments.filter(a => a.status === 'in_progress').length
  const pendingCount = transformedAssignments.filter(a => a.status === 'pending').length
  const totalProgress = transformedAssignments.length > 0 
    ? transformedAssignments.reduce((acc, a) => acc + a.progress, 0) / transformedAssignments.length 
    : 0

  return (
    <div className="min-h-screen bg-background">
      <AppBar 
        role="employee" 
        user={{
          name: userName,
          email: userEmail,
          image: userImage
        }}
      />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8">
        <GreetingCard
          name={userName || t('employee')}
        />

        <Tabs value={defaultTab} onValueChange={(value) => {
          if (value && ['overview', 'assignments', 'progress'].includes(value)) {
            router.replace(`/employee?tab=${value}`, { scroll: false })
            saveCurrentTab('employee', value)
          }
        }} className="space-y-3 md:space-y-6">
          <div className="tabs-scroll-container">
            <TabsList className="grid w-full min-w-max grid-cols-3">
              <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
              <TabsTrigger value="assignments">{t('assignments')}</TabsTrigger>
              <TabsTrigger value="progress">{t('progress')}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
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

