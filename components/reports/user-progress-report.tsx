"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { 
  Users, 
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
}

interface UserProgress {
  user: User
  assignments: Assignment[]
  completedCount: number
  totalCount: number
  averageScore: number
  overdueCount: number
}

interface UserProgressReportProps {
  users: User[]
  assignments: Assignment[]
}

export default function UserProgressReport({ users, assignments }: UserProgressReportProps) {
  const [userProgress, setUserProgress] = useState<UserProgress[]>([])

  useEffect(() => {
    // Filter out users with owner and manager roles - only show employees
    const employeeUsers = users.filter(user => user.role === 'employee')
    
    // Calculate progress for each employee user
    const progressData: UserProgress[] = employeeUsers.map(user => {
      // Find assignments assigned to this user
      const userAssignments = assignments.filter(assignment => {
        if (!Array.isArray(assignment.assignedUsers)) return false
        return assignment.assignedUsers.some((assignedUser: any) => 
          assignedUser.id?.toString() === user.id || assignedUser.name === user.name
        )
      })

      const completedCount = userAssignments.filter(assignment => 
        assignment.status === 'completed' || assignment.status === 'passed'
      ).length

      const overdueCount = userAssignments.filter(assignment => {
        const dueDate = new Date(assignment.dueDate)
        const now = new Date()
        return dueDate < now && assignment.status !== 'completed' && assignment.status !== 'passed'
      }).length

      const completedWithScores = userAssignments.filter(assignment => 
        assignment.testScore !== undefined
      )

      const averageScore = completedWithScores.length > 0
        ? Math.round(completedWithScores.reduce((sum, assignment) => sum + (assignment.testScore || 0), 0) / completedWithScores.length)
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
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'passed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>
      case 'active':
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
      case 'failed':
        return <Badge className="bg-red-50 text-black">Failed</Badge>
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800">Overdue</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Not Started</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const isOverdue = (dueDate: string, status: string) => {
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
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No employees or assignments found</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Employee Progress Report
        </CardTitle>
        <CardDescription>Track employee progress and assignment completion</CardDescription>
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
                        <div className="text-sm text-gray-600">{progress.user.job}</div>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 text-sm">
                      <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{progress.completedCount}/{progress.totalCount}</div>
                            <div className="text-gray-600">Completed</div>
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{progress.averageScore}%</div>
                            <div className="text-gray-600">Avg Score</div>
                          </div>
                        </div>
                        {progress.overdueCount > 0 && (
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-red-600">{progress.overdueCount}</div>
                              <div className="text-gray-600">Overdue</div>
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
                    <div className="text-center py-4 text-gray-500">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p>No assignments assigned</p>
                    </div>
                  ) : (
                    progress.assignments.map((assignment) => (
                      <div key={assignment.id} className="p-4 border rounded-lg bg-gray-50">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{assignment.name}</h4>
                              {getStatusIcon(assignment.status)}
                              {getStatusBadge(assignment.status)}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{assignment.description}</p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <FileText className="h-4 w-4" />
                                <span>{typeof assignment.document === 'object' && assignment.document && 'name' in assignment.document ? assignment.document.name : 'Unknown Document'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Target className="h-4 w-4" />
                                <span>{typeof assignment.test === 'object' && assignment.test && 'title' in assignment.test ? assignment.test.title : 'Unknown Test'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span className={isOverdue(assignment.dueDate, assignment.status) ? 'text-red-600' : ''}>
                                  Due: {formatDate(assignment.dueDate)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-row md:flex-col md:text-right gap-3 md:gap-0">
                            {assignment.testScore !== undefined && (
                              <div className="text-lg font-bold text-blue-600">
                                {assignment.testScore}%
                              </div>
                            )}
                            {isOverdue(assignment.dueDate, assignment.status) && (
                              <div className="text-xs text-red-600 font-medium">Overdue</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
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
