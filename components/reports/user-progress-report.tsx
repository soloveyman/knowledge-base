"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useTranslation } from "@/lib/translation-context"
import { useBadgeTranslation } from "@/lib/badge-translations"
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  FileText,
  Target,
  Calendar
} from "lucide-react"

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

export default function UserProgressReport({ users, assignments, modules = [], tests = [] }: UserProgressReportProps) {
  const [userProgress, setUserProgress] = useState<UserProgress[]>([])
  const { t } = useTranslation()
  const translateBadge = useBadgeTranslation()

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

      const completedWithScores = userAssignments.filter(assignment => {
        const userAssignment = assignment.users?.find((au: AssignedUser) => au.userId === user.id)
        return userAssignment?.status === 'completed'
      })

      // Get the actual scores from test attempts
      const scores: number[] = []
      for (const assignment of completedWithScores) {
        // Find the user's test score from the assignment's users array
        const userAssignment = assignment.users?.find((au: AssignedUser) => au.userId === user.id)
        if (userAssignment?.testScore !== undefined && userAssignment.testScore !== null) {
          scores.push(userAssignment.testScore)
        }
      }
      
      const averageScore = scores.length > 0
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
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

    setUserProgress(progressData)
  }, [users, assignments])

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
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const isOverdue = (dueDate: string | undefined, status: string) => {
    if (!dueDate) return false
    const due = new Date(dueDate)
    const now = new Date()
    return due < now && status !== 'completed' && status !== 'passed'
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
            {t('employeeProgressReport')}
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
                className="hover:no-underline relative [&>svg]:absolute [&>svg]:top-4 [&>svg]:right-4 md:[&>svg]:static md:[&>svg]:top-auto md:[&>svg]:right-auto"
              >
                <div className="flex flex-col md:flex-row md:items-center w-full gap-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 flex-1">
                    <div className="flex items-center justify-between md:justify-start gap-3">
                      <div className="text-left">
                        <div className="font-medium">{progress.user.name}</div>
                        <div className="text-sm text-muted-foreground">{progress.user.job}</div>
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
                      const actualDescription = assignment.description || assignment.title || assignment.name || `Complete assignment ${assignment.id.slice(0, 8)}`
                      
                      return (
                      <div key={assignment.id} className="p-4 border rounded-3xl bg-card">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{actualTitle}</h4>
                              {getStatusIcon(actualStatus)}
                              {getStatusBadge(actualStatus)}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{actualDescription}</p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                              {assignment.testId && (
                                <div className="flex items-center gap-1">
                                  <Target className="h-4 w-4" />
                                  <span>Test: {(() => {
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
