"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useTranslation } from "@/lib/translation-context"
import { useBadgeTranslation } from "@/lib/badge-translations"
import { formatDateShort } from "@/lib/date-format"
import { useSession } from "next-auth/react"
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  FileText,
  Target,
  Calendar
} from "lucide-react"

// Recursive type for answer values (can be nested objects/arrays)
type AnswerValue = 
  | string 
  | number 
  | boolean 
  | null 
  | undefined 
  | AnswerValue[] 
  | { [key: string]: AnswerValue }

interface User {
  id: string
  name: string
  job: string
  email: string
  role: string
  createdAt: string
  createdBy: string
  status: string
}

interface Assignment {
  id: string
  name?: string
  title?: string
  description?: string
  moduleId: string
  testId: string
  assignedTo?: string
  assignedBy: string
  dueDate?: string
  status: string
  allowRetake: boolean
  maxAttempts: number
  createdAt: string
  updatedAt: string
  users?: AssignedUser[]
}

interface AssignedUser {
  userId: string
  status?: string
  testScore?: number | null
}

interface UserProgress {
  user: User
  assignments: Assignment[]
  completedCount: number
  totalCount: number
  averageScore: number
  overdueCount: number
}

interface Module {
  id: string
  title: string
}

interface Test {
  id: string
  title: string
}

interface UserProgressReportProps {
  users: User[]
  assignments: Assignment[]
  modules?: Module[]
  tests?: Test[]
}

interface AttemptStats {
  totalAttempts: number
  passedAttempts: number
  failedAttempts: number
  bestScore: number | null
  averageScore: number | null
}

interface TestAttempt {
  id: string
  testId: string
  userId: string
  answers: Record<string, string | string[]>
  score: number | null
  status: string
  completedAt: string | null
}

interface Question {
  id: string
  content?: string
  title?: string
  type?: string
  correctAnswer?: string | null
  options?: string[] | null
  choices?: string[] | null
}

export default function UserProgressReport({ users, assignments, modules = [], tests = [] }: UserProgressReportProps) {
  const [userProgress, setUserProgress] = useState<UserProgress[]>([])
  const [attemptStats, setAttemptStats] = useState<Record<string, Record<string, AttemptStats>>>({})
  const [userAttemptScores, setUserAttemptScores] = useState<Record<string, number[]>>({})
  const [testAnswers, setTestAnswers] = useState<Record<string, Record<string, TestAttempt[]>>>({})
  const [testQuestions, setTestQuestions] = useState<Record<string, Question[]>>({})
  const { data: session } = useSession()
  const { t, language } = useTranslation()
  const translateBadge = useBadgeTranslation()
  
  // Check if current user is owner or manager
  const canViewAnswers = session?.user?.role === 'owner' || session?.user?.role === 'manager'
  
  // Map language to locale for date formatting
  const dateLocale = language === 'ru' ? 'ru-RU' : 'en-US'

  // Load all test attempts for each user across all their assignments (parallelized)
  // Use cache-busting to ensure fresh data
  const loadAllAttemptScores = useCallback(async () => {
    const scoresByUser: Record<string, number[]> = {}
    
    // Collect all fetch promises upfront for parallel execution
    const fetchPromises: Array<{ userId: string; testId: string; promise: Promise<Response> }> = []
    
    for (const user of users) {
      if (user.role !== 'employee') continue
      
      // Get all assignments for this user that have a testId
      const userAssignments = assignments.filter(assignment => {
        if (!assignment.testId) return false
        if (assignment.users && Array.isArray(assignment.users)) {
          return assignment.users.some((au: AssignedUser) => au.userId === user.id)
        }
        return false
      })
      
      if (userAssignments.length === 0) {
        scoresByUser[user.id] = []
        continue
      }
      
      // Get all unique testIds from user's assignments
      const testIds = [...new Set(userAssignments.map(a => a.testId).filter(Boolean))]
      
      // Create fetch promises for all testIds (parallel execution) with cache-busting
      testIds.forEach(testId => {
        fetchPromises.push({
          userId: user.id,
          testId,
          promise: fetch(`/api/test-attempts?userId=${user.id}&testId=${testId}&_t=${Date.now()}`, {
            cache: 'no-store'
          })
        })
      })
    }
    
    // Execute all fetches in parallel
    const responses = await Promise.allSettled(fetchPromises.map(f => f.promise))
    
    // Process results in parallel
    await Promise.all(responses.map(async (result, index) => {
      const { userId, testId } = fetchPromises[index]
      
      if (result.status === 'fulfilled') {
        try {
          const apiResult = await result.value.json()
          if (apiResult.success && apiResult.data.attempts) {
            const attempts = apiResult.data.attempts
            const completedAttempts = attempts.filter((a: any) => 
              a.status === 'completed' && a.score !== null && a.score !== undefined
            )
            if (!scoresByUser[userId]) {
              scoresByUser[userId] = []
            }
            completedAttempts.forEach((a: any) => {
              scoresByUser[userId].push(a.score ?? 0)
            })
          }
        } catch (error) {
          console.error(`Error processing attempts for user ${userId}, test ${testId}:`, error)
        }
      } else {
        console.error(`Error loading attempts for user ${userId}, test ${testId}:`, result.reason)
      }
    }))
    
    setUserAttemptScores(scoresByUser)
  }, [assignments, users])

  useEffect(() => {
    loadAllAttemptScores()
  }, [loadAllAttemptScores])

  // Reload data when page becomes visible (e.g., when returning from test page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Reload attempt scores when page becomes visible
        loadAllAttemptScores()
      }
    }

    const handleFocus = () => {
      // Reload attempt scores when window gains focus
      loadAllAttemptScores()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadAllAttemptScores])

  // Load test attempt statistics for each assignment (parallelized)
  // Use cache-busting to ensure fresh data
  const loadAttemptStats = useCallback(async () => {
    const stats: Record<string, Record<string, AttemptStats>> = {}
    
    // Collect all fetch promises upfront for parallel execution
    const fetchPromises: Array<{ assignmentId: string; userId: string; testId: string; promise: Promise<Response> }> = []
    
    for (const assignment of assignments) {
      if (!assignment.testId) continue
      
      stats[assignment.id] = {}
      
      for (const user of users) {
        if (user.role !== 'employee') continue
        
        fetchPromises.push({
          assignmentId: assignment.id,
          userId: user.id,
          testId: assignment.testId,
          promise: fetch(`/api/test-attempts?userId=${user.id}&testId=${assignment.testId}&_t=${Date.now()}`, {
            cache: 'no-store'
          })
        })
      }
    }
    
    // Execute all fetches in parallel
    const responses = await Promise.allSettled(fetchPromises.map(f => f.promise))
    
    // Process results in parallel
    await Promise.all(responses.map(async (result, index) => {
      const { assignmentId, userId, testId } = fetchPromises[index]
      
      if (result.status === 'fulfilled') {
        try {
          const apiResult = await result.value.json()
          
          if (apiResult.success && apiResult.data.attempts) {
            const attempts = apiResult.data.attempts
            // Include all attempts (completed and failed) for total count
            const totalAttempts = attempts.length
            // Filter completed attempts with scores for statistics
            const completedAttempts = attempts.filter((a: any) => a.status === 'completed' && a.score !== null && a.score !== undefined)
            // Count passed (score >= 70) and failed (score < 70) attempts
            const passedAttempts = completedAttempts.filter((a: any) => (a.score ?? 0) >= 70).length
            const failedAttempts = completedAttempts.filter((a: any) => (a.score ?? 0) < 70).length
            const bestScore = completedAttempts.length > 0 
              ? Math.max(...completedAttempts.map((a: any) => a.score ?? 0))
              : null
            const averageScore = completedAttempts.length > 0
              ? Math.round(completedAttempts.reduce((acc: number, a: any) => acc + (a.score ?? 0), 0) / completedAttempts.length)
              : null
            
            if (!stats[assignmentId]) {
              stats[assignmentId] = {}
            }
            stats[assignmentId][userId] = {
              totalAttempts,
              passedAttempts,
              failedAttempts,
              bestScore,
              averageScore
            }
          }
        } catch (error) {
          console.error(`Error processing attempts for assignment ${assignmentId}, user ${userId}:`, error)
        }
      } else {
        console.error(`Error loading attempts for assignment ${assignmentId}, user ${userId}:`, result.reason)
      }
    }))
    
    setAttemptStats(stats)
  }, [assignments, users])

  useEffect(() => {
    loadAttemptStats()
  }, [loadAttemptStats])

  // Load test answers for each employee's completed tests (only for owner/manager)
  const loadTestAnswers = useCallback(async () => {
    if (!canViewAnswers) return
    
    const answersByAssignment: Record<string, Record<string, TestAttempt[]>> = {}
    
    // Collect all fetch promises upfront for parallel execution
    const fetchPromises: Array<{ assignmentId: string; userId: string; testId: string; promise: Promise<Response> }> = []
    
    for (const assignment of assignments) {
      if (!assignment.testId) continue
      
      answersByAssignment[assignment.id] = {}
      
      for (const user of users) {
        if (user.role !== 'employee') continue
        
        fetchPromises.push({
          assignmentId: assignment.id,
          userId: user.id,
          testId: assignment.testId,
          promise: fetch(`/api/test-attempts?userId=${user.id}&testId=${assignment.testId}&_t=${Date.now()}`, {
            cache: 'no-store'
          })
        })
      }
    }
    
    // Execute all fetches in parallel
    const responses = await Promise.allSettled(fetchPromises.map(f => f.promise))
    
    // Process results in parallel
    await Promise.all(responses.map(async (result, index) => {
      const { assignmentId, userId, testId } = fetchPromises[index]
      
      if (result.status === 'fulfilled') {
        try {
          const apiResult = await result.value.json()
          
          if (apiResult.success && apiResult.data.attempts) {
            const attempts = apiResult.data.attempts as TestAttempt[]
            // Only get completed attempts with answers
            const completedAttempts = attempts.filter((a: TestAttempt) => 
              a.status === 'completed' && a.answers && Object.keys(a.answers).length > 0
            )
            
            // Find the best attempt (highest score)
            // If scores are equal, prefer the most recent one
            const bestAttempt = completedAttempts.length > 0
              ? completedAttempts.reduce((best, current) => {
                  const bestScore = best.score ?? 0
                  const currentScore = current.score ?? 0
                  
                  // If current has higher score, it's better
                  if (currentScore > bestScore) {
                    return current
                  }
                  // If scores are equal, prefer the most recent
                  if (currentScore === bestScore) {
                    const bestDate = best.completedAt ? new Date(best.completedAt).getTime() : 0
                    const currentDate = current.completedAt ? new Date(current.completedAt).getTime() : 0
                    return currentDate > bestDate ? current : best
                  }
                  // Otherwise keep the best
                  return best
                })
              : null
            
            if (bestAttempt) {
              if (!answersByAssignment[assignmentId]) {
                answersByAssignment[assignmentId] = {}
              }
              answersByAssignment[assignmentId][userId] = [bestAttempt]
            }
          }
        } catch (error) {
          console.error(`Error processing answers for assignment ${assignmentId}, user ${userId}:`, error)
        }
      } else {
        console.error(`Error loading answers for assignment ${assignmentId}, user ${userId}:`, result.reason)
      }
    }))
    
    setTestAnswers(answersByAssignment)
  }, [assignments, users, canViewAnswers])

  useEffect(() => {
    if (canViewAnswers) {
      loadTestAnswers()
    }
  }, [loadTestAnswers, canViewAnswers])

  // Load questions for all unique testIds from assignments
  const loadTestQuestions = useCallback(async () => {
    if (!canViewAnswers) return
    
    // Get all unique testIds from assignments
    const uniqueTestIds = [...new Set(assignments
      .filter(a => a.testId)
      .map(a => a.testId)
      .filter(Boolean) as string[]
    )]
    
    if (uniqueTestIds.length === 0) return
    
    const questionsByTest: Record<string, Question[]> = {}
    
    // Load questions for each test in parallel
    const fetchPromises = uniqueTestIds.map(async (testId) => {
      try {
        const response = await fetch(`/api/tests/${testId}?_t=${Date.now()}`, {
          cache: 'no-store'
        })
        const result = await response.json()
        
        if (result.success && result.data.questions) {
          questionsByTest[testId] = result.data.questions.map((q: any) => {
            // Drizzle maps snake_case DB columns to camelCase schema fields
            // But we need to handle both formats for compatibility
            const questionOptions = q.options || q.choices || null
            const correctAnswer = q.correctAnswer || q.correct_answer || null
            
            return {
              id: q.id,
              content: q.content || q.title || '',
              title: q.title || q.content || '',
              type: q.type || 'multiple_choice',
              correctAnswer: correctAnswer,
              options: questionOptions,
              choices: questionOptions // Alias for compatibility
            }
          })
        }
      } catch (error) {
        console.error(`Error loading questions for test ${testId}:`, error)
      }
    })
    
    await Promise.all(fetchPromises)
    setTestQuestions(questionsByTest)
  }, [assignments, canViewAnswers])

  useEffect(() => {
    if (canViewAnswers) {
      loadTestQuestions()
    }
  }, [loadTestQuestions, canViewAnswers])

  // Reload answers when page becomes visible
  useEffect(() => {
    if (!canViewAnswers) return
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadTestAnswers()
      }
    }

    const handleFocus = () => {
      loadTestAnswers()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadTestAnswers, canViewAnswers])

  // Reload stats when page becomes visible (e.g., when returning from test page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Reload attempt stats when page becomes visible
        loadAttemptStats()
      }
    }

    const handleFocus = () => {
      // Reload attempt stats when window gains focus
      loadAttemptStats()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadAttemptStats])

  useEffect(() => {
    console.log('UserProgressReport: useEffect triggered')
    console.log('UserProgressReport: Users:', users.length, users)
    console.log('UserProgressReport: Assignments:', assignments.length, assignments)
    
    // Filter out users with owner and manager roles - only show employees
    const employeeUsers = users.filter(user => user.role === 'employee')
    console.log('UserProgressReport: Employee users:', employeeUsers.length, employeeUsers)
    
    // Calculate progress for each employee user
    const progressData: UserProgress[] = employeeUsers.map(user => {
      // Find assignments assigned to this user using the assignment_users junction table
      const userAssignments = assignments.filter(assignment => {
        // Check if this assignment has users array and contains the current user
        if (assignment.users && Array.isArray(assignment.users)) {
          return assignment.users.some((au: AssignedUser) => au.userId === user.id)
        }
        return false
      })

      // Use the actual user's status from assignment_users instead of the generic assignment status
      const completedCount = userAssignments.filter(assignment => {
        const userAssignment = assignment.users?.find((au: AssignedUser) => au.userId === user.id)
        return userAssignment?.status === 'completed' || userAssignment?.status === 'passed'
      }).length

      const overdueCount = userAssignments.filter(assignment => {
        if (!assignment.dueDate) return false
        const userAssignment = assignment.users?.find((au: AssignedUser) => au.userId === user.id)
        const dueDate = new Date(assignment.dueDate)
        const now = new Date()
        return dueDate < now && userAssignment?.status !== 'completed' && userAssignment?.status !== 'passed'
      }).length

      // Get all test attempts scores for this user across all their assignments
      // Use the pre-loaded attempt scores from all assignments
      const allAttemptScores = userAttemptScores[user.id] || []
      
      const averageScore = allAttemptScores.length > 0
        ? Math.round(allAttemptScores.reduce((sum, score) => sum + score, 0) / allAttemptScores.length)
        : 0

      return {
        user,
        assignments: userAssignments,
        completedCount,
        totalCount: userAssignments.length,
        averageScore,
        overdueCount
      }
    })

    // Use setTimeout to avoid synchronous setState in effect
    setTimeout(() => {
      setUserProgress(progressData)
    }, 0)
  }, [users, assignments, userAttemptScores])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'active':
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'failed':
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'passed':
        return <Badge className="bg-green-500/20 text-green-600 dark:text-green-400">{translateBadge('completed')}</Badge>
      case 'active':
      case 'in_progress':
        return <Badge className="bg-primary/20 text-primary-700 dark:text-primary-300">{translateBadge('inProgress')}</Badge>
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-600 dark:text-red-400">{translateBadge('failed')}</Badge>
      case 'overdue':
        return <Badge className="bg-red-500/20 text-red-600 dark:text-red-400">{translateBadge('overdue')}</Badge>
      default:
        return <Badge className="bg-muted text-muted-foreground">{translateBadge('notStarted')}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return formatDateShort(dateString, dateLocale)
  }

  const isOverdue = (dueDate: string | undefined, status: string) => {
    if (!dueDate) return false
    const due = new Date(dueDate)
    const now = new Date()
    return due < now && status !== 'completed' && status !== 'passed'
  }

  // Format answer for display with translations
  const formatAnswer = (answer: AnswerValue): string => {
    // Handle null/undefined
    if (answer === null || answer === undefined) {
      return '-'
    }
    
    // Handle boolean values
    if (typeof answer === 'boolean') {
      return answer ? t('true') : t('false')
    }
    
    // Handle strings (including boolean strings)
    if (typeof answer === 'string') {
      const normalized = answer.trim().toLowerCase()
      // Translate boolean strings
      if (normalized === 'true' || normalized === 'верно' || normalized === 'да') {
        return t('true')
      }
      if (normalized === 'false' || normalized === 'неверно' || normalized === 'нет') {
        return t('false')
      }
      return answer
    }
    
    // Handle arrays
    if (Array.isArray(answer)) {
      if (answer.length === 0) return '-'
      return answer.map(item => formatAnswer(item)).join(', ')
    }
    
    // Handle objects - try to extract meaningful values
    if (typeof answer === 'object') {
      try {
        // If it's an array-like object, convert to array
        if (Array.isArray(answer)) {
          return answer.map(item => formatAnswer(item)).join(', ')
        }
        // For simple objects, extract values
        const values = Object.values(answer).filter(v => v !== null && v !== undefined)
        if (values.length > 0) {
          return values.map(v => formatAnswer(v)).join(', ')
        }
        return JSON.stringify(answer)
      } catch {
        return String(answer)
      }
    }
    
    // For numbers and other types
    return String(answer)
  }

  if (userProgress.length === 0) {
    return (
      <Card>
        <CardHeader>
        <CardTitle>
          Employee Progress Report
        </CardTitle>
          <CardDescription>Track employee progress and assignment completion</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <span className="text-5xl block mb-4">👥</span>
            <p>No employees or assignments found</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>
            <span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">📈</span> <span className="leading-none self-center">{t('employeeProgressReport')}</span>
          </CardTitle>
          <CardDescription>{t('trackEmployeeProgress')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="space-y-2">
          {userProgress.map((progress) => (
            <AccordionItem key={progress.user.id} value={progress.user.id}>
              <AccordionTrigger 
                value={progress.user.id}
                className="hover:no-underline relative md:items-center [&>svg]:absolute [&>svg]:top-4 [&>svg]:right-4 md:[&>svg]:static md:[&>svg]:top-auto md:[&>svg]:right-auto md:[&>svg]:mt-0"
              >
                <div className="flex flex-col md:flex-row md:items-center w-full gap-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 flex-1 min-w-0">
                    <div className="flex items-center justify-between md:justify-start gap-3 min-w-0">
                      <div className="text-left min-w-0 flex-1">
                        <div className="font-medium break-words">{progress.user.name}</div>
                        <div className="text-sm text-muted-foreground break-words">{progress.user.job}</div>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 text-sm">
                      <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{progress.completedCount}/{progress.totalCount}</div>
                            <div className="text-muted-foreground">{t('completed')}</div>
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{progress.averageScore}%</div>
                            <div className="text-muted-foreground">{t('avgScore')}</div>
                          </div>
                        </div>
                        {progress.overdueCount > 0 && (
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-red-600">{progress.overdueCount}</div>
                              <div className="text-muted-foreground">{t('overdue')}</div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="w-full md:w-20">
                        <Progress 
                          value={progress.totalCount > 0 ? (progress.completedCount / progress.totalCount) * 100 : 0} 
                          className="h-2" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent value={progress.user.id}>
                <div className="space-y-3">
                  {progress.assignments.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <span className="text-4xl block mb-2">📋</span>
                      <p>No assignments assigned</p>
                    </div>
                  ) : (
                    progress.assignments.map((assignment) => {
                      // Get the user's specific assignment details
                      const userAssignment = assignment.users?.find((au: AssignedUser) => au.userId === progress.user.id)
                      const actualStatus = userAssignment?.status || assignment.status || 'pending'
                      const actualTitle = assignment.title || assignment.name || `Assignment ${assignment.id.slice(0, 8)}`
                      const actualDescription = assignment.description || assignment.title || assignment.name || t('assignmentDescriptionDefault')
                      
                      const stats = attemptStats[assignment.id]?.[progress.user.id]
                      const userAnswers = canViewAnswers && assignment.testId 
                        ? testAnswers[assignment.id]?.[progress.user.id] || []
                        : []
                      
                      return (
                      <div key={assignment.id} className="p-4 border rounded-3xl bg-card">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h4 className="font-medium break-words">{actualTitle}</h4>
                              {getStatusIcon(actualStatus)}
                              {getStatusBadge(actualStatus)}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2 break-words">
                              {actualDescription}
                              {stats && stats.totalAttempts > 0 && (
                                <span className="ml-2 text-blue-600 font-medium">
                                  ({stats.totalAttempts} {stats.totalAttempts === 1 ? t('attempt') : t('attempts')})
                                </span>
                              )}
                            </p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                              {assignment.testId && (
                                <div className="flex items-center gap-1">
                                  <Target className="h-4 w-4" />
                                  <span className="break-words">Test: {(() => {
                                    const test = tests.find((t: Test) => t.id === assignment.testId)
                                    return test?.title || assignment.testId.slice(0, 8)
                                  })()}</span>
                                </div>
                              )}
                              {assignment.dueDate && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  <span className={isOverdue(assignment.dueDate, assignment.status) ? 'text-red-600' : ''}>
                                    Due: {formatDate(assignment.dueDate)}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {/* Show test answers for owner/manager (best attempt) */}
                            {canViewAnswers && userAnswers.length > 0 && (() => {
                              const bestAttempt = userAnswers[0] // Already filtered to best attempt
                              const accordionValue = `answers-${assignment.id}-${progress.user.id}`
                              
                              return (
                                <div className="mt-4 pt-4 border-t">
                                  <Accordion type="single" collapsible className="w-full">
                                    <AccordionItem value={accordionValue} className="border-none">
                                      <AccordionTrigger 
                                        value={accordionValue}
                                        className="py-2 hover:no-underline [&>svg]:shrink-0"
                                      >
                                        <div className="flex items-center justify-between w-full pr-4">
                                          <div className="text-sm font-medium text-foreground break-words">
                                            Ответы сотрудника (лучшая попытка):
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            {bestAttempt.completedAt && (
                                              <span>{formatDate(bestAttempt.completedAt)}</span>
                                            )}
                                            {bestAttempt.score !== null && (
                                              <Badge variant={bestAttempt.score >= 70 ? "default" : "destructive"} className="text-xs">
                                                {bestAttempt.score}%
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent value={accordionValue} className="pt-2 [&>div]:px-0">
                                        <div className="bg-muted/50 rounded-lg p-3 space-y-2.5">
                                          {(() => {
                                            const questions = assignment.testId ? testQuestions[assignment.testId] || [] : []
                                            
                                            // Helper function to check if answer is correct (same logic as before)
                                            const checkAnswerCorrectness = (questionId: string, answer: string | string[]): boolean | null => {
                                              const question = questions.find(q => q.id === questionId)
                                              if (!question?.correctAnswer) return null
                                              
                                              const correctAnswer = question.correctAnswer
                                              const userAnswerValue: string | string[] = answer
                                              const userAnswer = typeof userAnswerValue === 'string' 
                                                ? userAnswerValue.trim() 
                                                : (Array.isArray(userAnswerValue) 
                                                    ? userAnswerValue.join(',') 
                                                    : String(userAnswerValue))
                                              const choices = question.choices || question.options || []
                                              
                                              // Handle text/complete questions
                                              if (question.type === 'complete' || question.type === 'text') {
                                                const normalizeText = (text: string): string => {
                                                  return text.toLowerCase().trim().replace(/\s+/g, ' ')
                                                }
                                                const userAnswerStr = Array.isArray(userAnswerValue) 
                                                  ? userAnswerValue.join(' ').trim() 
                                                  : (typeof userAnswerValue === 'string' ? userAnswerValue.trim() : '')
                                                const normalizedUser = normalizeText(userAnswerStr)
                                                const normalizedCorrect = normalizeText(correctAnswer || '')
                                                return normalizedUser === normalizedCorrect
                                              }
                                              
                                              // Handle multiple choice with multiple answers (mcq_multi)
                                              if (question.type === 'mcq_multi' || /[,;]/.test(correctAnswer)) {
                                                const correctAnswerParts = correctAnswer.split(/[,;\s]+/).filter(p => p.length > 0)
                                                const correctAnswerLetters: string[] = []
                                                
                                                for (const part of correctAnswerParts) {
                                                  let letter: string | null = null
                                                  if (/^[A-Z]$/i.test(part)) {
                                                    letter = part.toUpperCase()
                                                  } else if (/^\d+$/.test(part) && choices.length > 0) {
                                                    const index = parseInt(part, 10)
                                                    if (index >= 1 && index <= choices.length) {
                                                      letter = String.fromCharCode(65 + index - 1)
                                                    }
                                                  } else if (choices.length > 0) {
                                                    const choiceIndex = choices.findIndex(
                                                      (choice: string) => choice.trim().toLowerCase() === part.trim().toLowerCase()
                                                    )
                                                    if (choiceIndex >= 0) {
                                                      letter = String.fromCharCode(65 + choiceIndex)
                                                    }
                                                  }
                                                  if (letter) correctAnswerLetters.push(letter)
                                                }
                                                
                                                const userAnswers = Array.isArray(userAnswerValue)
                                                  ? userAnswerValue.map(a => a.toUpperCase())
                                                  : (userAnswer ? userAnswer.split(/[,;\s]+/).filter(p => p.length > 0).map(a => a.toUpperCase()) : [])
                                                
                                                const correctAnswersSet = new Set(correctAnswerLetters)
                                                const userAnswersSet = new Set(userAnswers)
                                                const allCorrectSelected = correctAnswerLetters.every(letter => userAnswersSet.has(letter))
                                                const noIncorrectSelected = userAnswers.every(letter => correctAnswersSet.has(letter))
                                                const sameCount = correctAnswerLetters.length === userAnswers.length
                                                
                                                return allCorrectSelected && noIncorrectSelected && sameCount
                                              }
                                              
                                              // Handle single choice multiple choice and true/false
                                              let correctAnswerLetter: string | null = null
                                              
                                              if (/^[A-Z]$/i.test(correctAnswer)) {
                                                correctAnswerLetter = correctAnswer.toUpperCase()
                                              } else if (/^\d+$/.test(correctAnswer) && choices.length > 0) {
                                                const index = parseInt(correctAnswer, 10)
                                                if (index >= 1 && index <= choices.length) {
                                                  correctAnswerLetter = String.fromCharCode(65 + index - 1)
                                                } else if (index === 0 && choices.length > 0) {
                                                  correctAnswerLetter = String.fromCharCode(65 + 0)
                                                }
                                              } else if (choices.length > 0 && correctAnswer) {
                                                const choiceIndex = choices.findIndex(
                                                  (choice: string) => choice.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
                                                )
                                                if (choiceIndex >= 0) {
                                                  correctAnswerLetter = String.fromCharCode(65 + choiceIndex)
                                                }
                                              }
                                              
                                              // Handle true/false questions
                                              if (question.type === 'tf' || question.type === 'true_false') {
                                                const normalizeTrueFalse = (val: string): string => {
                                                  const normalized = val.trim().toLowerCase()
                                                  // English variants
                                                  if (normalized === 'true' || normalized === '1') {
                                                    return 'true'
                                                  }
                                                  if (normalized === 'false' || normalized === '0') {
                                                    return 'false'
                                                  }
                                                  // Russian variants
                                                  if (normalized === 'верно' || normalized === 'да' || normalized === 'истина' || normalized === 'правда') {
                                                    return 'true'
                                                  }
                                                  if (normalized === 'неверно' || normalized === 'нет' || normalized === 'ложь' || normalized === 'неправда') {
                                                    return 'false'
                                                  }
                                                  return normalized
                                                }
                                                
                                                const normalizedCorrect = normalizeTrueFalse(correctAnswer)
                                                if (normalizedCorrect === 'true' || normalizedCorrect === 'false') {
                                                  const userAnswerStr = Array.isArray(userAnswerValue) 
                                                    ? userAnswerValue[0] 
                                                    : (typeof userAnswerValue === 'string' ? userAnswerValue : String(userAnswerValue))
                                                  const normalizedUser = normalizeTrueFalse(userAnswerStr)
                                                  return normalizedUser === normalizedCorrect
                                                }
                                              }
                                              
                                              // Compare normalized answers for single choice questions
                                              if (correctAnswerLetter) {
                                                const userAnswerStr = Array.isArray(userAnswerValue) 
                                                  ? userAnswerValue[0] 
                                                  : (typeof userAnswerValue === 'string' ? userAnswerValue : '')
                                                const normalizedUser = userAnswerStr.toUpperCase().trim()
                                                return normalizedUser === correctAnswerLetter.toUpperCase()
                                              }
                                              
                                              // Fallback: direct string comparison
                                              const userAnswerStr = Array.isArray(userAnswerValue) 
                                                ? userAnswerValue.join(' ') 
                                                : (typeof userAnswerValue === 'string' ? userAnswerValue : String(userAnswerValue))
                                              const normalize = (val: string) => val.toLowerCase().trim()
                                              return normalize(correctAnswer) === normalize(userAnswerStr)
                                            }
                                            
                                            // Filter to show only incorrect answers
                                            const incorrectAnswers = Object.entries(bestAttempt.answers)
                                              .map(([questionId, answer]) => {
                                                const question = questions.find(q => q.id === questionId)
                                                const questionText = question?.content || question?.title || `Вопрос #${questionId.slice(0, 8)}`
                                                const isCorrect = checkAnswerCorrectness(questionId, answer)
                                                
                                                return {
                                                  questionId,
                                                  answer,
                                                  questionText,
                                                  question,
                                                  isCorrect
                                                }
                                              })
                                              .filter(item => item.isCorrect === false) // Show only incorrect answers
                                            
                                            // Show message if no incorrect answers
                                            if (incorrectAnswers.length === 0) {
                                              return (
                                                <div className="text-sm text-muted-foreground text-center py-2">
                                                  {t('noIncorrectAnswers') || 'Все ответы правильные'}
                                                </div>
                                              )
                                            }
                                            
                                            // Display all incorrect answers
                                            return incorrectAnswers.map(({ questionId, answer, questionText, question }) => (
                                              <div key={questionId} className="text-sm">
                                                <div className="font-medium text-foreground mb-1.5 break-words" translate="no">
                                                  {questionText}:
                                                </div>
                                                <div className="pl-3 border-l-2 rounded-r py-1.5 px-2 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 break-words">
                                                  <div className="mb-1 break-words">
                                                    <span className="font-medium">{t('userAnswer') || 'Ответ сотрудника'}:</span> <span className="break-words" translate="no">{formatAnswer(answer)}</span>
                                                  </div>
                                                  {question?.correctAnswer && (() => {
                                                    // Format correct answer for display
                                                    // For MCQ questions, convert indices/letters to readable format
                                                    let formattedCorrectAnswer = question.correctAnswer
                                                    
                                                    // Handle true/false questions - translate the answer
                                                    if (question.type === 'tf' || question.type === 'true_false') {
                                                      const normalized = formattedCorrectAnswer.trim().toLowerCase()
                                                      if (normalized === 'true' || normalized === 'верно' || normalized === 'да') {
                                                        formattedCorrectAnswer = t('true')
                                                      } else if (normalized === 'false' || normalized === 'неверно' || normalized === 'нет') {
                                                        formattedCorrectAnswer = t('false')
                                                      } else {
                                                        // Use formatAnswer for consistency
                                                        formattedCorrectAnswer = formatAnswer(formattedCorrectAnswer)
                                                      }
                                                    } else if (question.choices && question.choices.length > 0) {
                                                      // If correctAnswer is a letter (A, B, C, D)
                                                      if (/^[A-Z]$/i.test(question.correctAnswer)) {
                                                        const letterIndex = question.correctAnswer.toUpperCase().charCodeAt(0) - 65
                                                        if (letterIndex >= 0 && letterIndex < question.choices.length) {
                                                          formattedCorrectAnswer = `${question.correctAnswer}: ${question.choices[letterIndex]}`
                                                        }
                                                      }
                                                      // If correctAnswer is a numeric index (1, 2, 3, 4) - 1-based
                                                      else if (/^\d+$/.test(question.correctAnswer)) {
                                                        const index = parseInt(question.correctAnswer, 10)
                                                        if (index >= 1 && index <= question.choices.length) {
                                                          const letter = String.fromCharCode(65 + index - 1)
                                                          formattedCorrectAnswer = `${letter}: ${question.choices[index - 1]}`
                                                        }
                                                      }
                                                      // If correctAnswer is multiple (comma-separated)
                                                      else if (/[,;]/.test(question.correctAnswer)) {
                                                        const parts = question.correctAnswer.split(/[,;\s]+/).filter(p => p.length > 0)
                                                        const formattedParts = parts.map(part => {
                                                          if (!question.choices) return part
                                                          if (/^[A-Z]$/i.test(part)) {
                                                            const letterIndex = part.toUpperCase().charCodeAt(0) - 65
                                                            if (letterIndex >= 0 && letterIndex < question.choices.length) {
                                                              return `${part}: ${question.choices[letterIndex]}`
                                                            }
                                                          } else if (/^\d+$/.test(part)) {
                                                            const index = parseInt(part, 10)
                                                            if (index >= 1 && index <= question.choices.length) {
                                                              const letter = String.fromCharCode(65 + index - 1)
                                                              return `${letter}: ${question.choices[index - 1]}`
                                                            }
                                                          }
                                                          return part
                                                        })
                                                        formattedCorrectAnswer = formattedParts.join(', ')
                                                      }
                                                      // If correctAnswer matches one of the choice texts
                                                      else {
                                                        const correctAnswer = question.correctAnswer
                                                        if (correctAnswer) {
                                                          const choiceIndex = question.choices.findIndex(
                                                            (choice: string) => choice.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
                                                          )
                                                          if (choiceIndex >= 0) {
                                                            const letter = String.fromCharCode(65 + choiceIndex)
                                                            formattedCorrectAnswer = `${letter}: ${question.choices[choiceIndex]}`
                                                          }
                                                        }
                                                      }
                                                    } else {
                                                      // For other question types, use formatAnswer to handle true/false strings
                                                      formattedCorrectAnswer = formatAnswer(formattedCorrectAnswer)
                                                    }
                                                    
                                                    return (
                                                      <div className="text-green-600 dark:text-green-400 break-words">
                                                        <span className="font-medium">{t('correctAnswer') || 'Правильный ответ'}:</span> <span className="break-words" translate="no">{formattedCorrectAnswer}</span>
                                                      </div>
                                                    )
                                                  })()}
                                                </div>
                                              </div>
                                            ))
                                          })()}
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  </Accordion>
                                </div>
                              )
                            })()}
                          </div>
                          <div className="flex flex-row md:flex-col md:text-right gap-3 md:gap-0">
                            {actualStatus === 'completed' && (() => {
                              const score = userAssignment?.testScore
                              return score !== undefined && score !== null ? (
                                <div className="text-lg font-bold text-blue-600">
                                  {score}%
                                </div>
                              ) : null
                            })()}
                            {isOverdue(assignment.dueDate, actualStatus) && (
                              <div className="text-xs text-red-600 font-medium">Overdue</div>
                            )}
                          </div>
                        </div>
                      </div>
                      )
                    })
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}

