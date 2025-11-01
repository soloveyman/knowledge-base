"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/lib/badges"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { 
  BarChart3, 
  Download, 
  Filter, 
  Calendar,
  Users,
  Target,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Award,
  Activity
} from "lucide-react"

interface ReportData {
  moduleId: string
  moduleTitle: string
  totalAssigned: number
  started: number
  completed: number
  averageScore: number
  averageTimeSpent: number
  completionRate: number
  overdueCount: number
}

interface EmployeeProgress {
  id: string
  name: string
  email: string
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue'
  score?: number
  timeSpent: number
  lastActivity: string
  attempts: number
  maxAttempts: number
}

interface ReportFilters {
  dateRange: '7d' | '30d' | '90d' | '1y' | 'all'
  moduleId: string
  status: 'all' | 'completed' | 'in_progress' | 'not_started' | 'overdue'
  scoreRange: [number, number]
}

export default function ReportingDashboard() {
  const [reportData, setReportData] = useState<ReportData[]>([])
  const [employeeProgress, setEmployeeProgress] = useState<EmployeeProgress[]>([])
  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: '30d',
    moduleId: 'all',
    status: 'all',
    scoreRange: [0, 100]
  })
  const [selectedModule, setSelectedModule] = useState<string>('all')
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    loadReportData()
  }, [filters])

  const loadReportData = async () => {
    try {
      const response = await fetch('/api/reports/dashboard')
      const result = await response.json()
      
      if (result.success) {
        setReportData(result.data.reportData)
        setEmployeeProgress(result.data.employeeProgress)
      } else {
        console.error('Failed to load report data:', result.message)
        setReportData([])
        setEmployeeProgress([])
      }
    } catch (error) {
      console.error('Error loading report data:', error)
      setReportData([])
      setEmployeeProgress([])
    }
  }

  const handleFilterChange = (field: keyof ReportFilters, value: ReportFilters[keyof ReportFilters]) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleExport = async (format: 'csv' | 'pdf') => {
    setIsExporting(true)
    
    // Simulate export process
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // In production, this would generate and download the actual file
    const filename = `training-report-${new Date().toISOString().split('T')[0]}.${format}`
    console.log(`Exporting ${filename}...`)
    
    setIsExporting(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-600 dark:text-green-400'
      case 'in_progress': return 'bg-primary/20 text-primary-700 dark:text-primary-300'
      case 'not_started': return 'bg-muted text-muted-foreground'
      case 'overdue': return 'bg-red-500/20 text-red-600 dark:text-red-400'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
      case 'in_progress': return <Activity className="h-4 w-4 text-primary" />
      case 'not_started': return <Clock className="h-4 w-4 text-muted-foreground" />
      case 'overdue': return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
      default: return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const totalStats = reportData.reduce((acc, module) => ({
    totalAssigned: acc.totalAssigned + module.totalAssigned,
    started: acc.started + module.started,
    completed: acc.completed + module.completed,
    averageScore: acc.averageScore + module.averageScore,
    averageTimeSpent: acc.averageTimeSpent + module.averageTimeSpent,
    overdueCount: acc.overdueCount + module.overdueCount
  }), {
    totalAssigned: 0,
    started: 0,
    completed: 0,
    averageScore: 0,
    averageTimeSpent: 0,
    overdueCount: 0
  })

  const overallCompletionRate = totalStats.totalAssigned > 0 
    ? Math.round((totalStats.completed / totalStats.totalAssigned) * 100)
    : 0

  const overallAverageScore = reportData.length > 0 
    ? Math.round(totalStats.averageScore / reportData.length)
    : 0

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="dateRange">Date Range</Label>
              <Select
                value={filters.dateRange}
                onValueChange={(value) => handleFilterChange('dateRange', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="module">Module</Label>
              <Select
                value={filters.moduleId}
                onValueChange={(value) => handleFilterChange('moduleId', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {reportData.map((module) => (
                    <SelectItem key={module.moduleId} value={module.moduleId}>
                      {module.moduleTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={() => handleExport('csv')}
                disabled={isExporting}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assigned</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalAssigned}</div>
            <p className="text-xs text-muted-foreground">
              Across all modules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallCompletionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {totalStats.completed} of {totalStats.totalAssigned} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallAverageScore}%</div>
            <p className="text-xs text-muted-foreground">
              Across all completed tests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalStats.overdueCount}</div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Module Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Module Performance
          </CardTitle>
          <CardDescription>
            Performance metrics for each training module
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reportData.map((module) => (
              <div key={module.moduleId} className="p-4 border rounded-3xl">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium">{module.moduleTitle}</h4>
                    <p className="text-sm text-gray-600">
                      {module.totalAssigned} assigned • {module.completed} completed
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{module.completionRate}%</div>
                    <div className="text-sm text-gray-600">Completion Rate</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-600">{module.started}</div>
                    <div className="text-xs text-gray-600">Started</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">{module.completed}</div>
                    <div className="text-xs text-gray-600">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-yellow-600">{module.averageScore}%</div>
                    <div className="text-xs text-gray-600">Avg Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-purple-600">
                      {formatDuration(module.averageTimeSpent)}
                    </div>
                    <div className="text-xs text-gray-600">Avg Time</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{module.completionRate}%</span>
                  </div>
                  <Progress value={module.completionRate} className="h-2" />
                </div>

                {module.overdueCount > 0 && (
                  <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    {module.overdueCount} assignment(s) overdue
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Employee Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employee Progress
          </CardTitle>
          <CardDescription>
            Individual employee progress and performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {employeeProgress.map((employee) => (
              <div key={employee.id} className="flex items-center justify-between p-3 border rounded-3xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="font-medium">{employee.name}</h4>
                    <p className="text-sm text-muted-foreground">{employee.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-sm font-medium">
                      {employee.score ? `${employee.score}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-600">Score</div>
                  </div>

                  <div className="text-center">
                    <div className="text-sm font-medium">
                      {formatDuration(employee.timeSpent)}
                    </div>
                    <div className="text-xs text-gray-600">Time</div>
                  </div>

                  <div className="text-center">
                    <div className="text-sm font-medium">
                      {employee.attempts}/{employee.maxAttempts}
                    </div>
                    <div className="text-xs text-muted-foreground">Attempts</div>
                  </div>

                  <StatusBadge status={employee.status} />

                  <div className="text-right text-xs text-muted-foreground">
                    <div>Last activity:</div>
                    <div>{formatDate(employee.lastActivity)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Reports
          </CardTitle>
          <CardDescription>
            Download detailed reports in various formats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="h-20 flex-col"
            >
              <FileText className="h-6 w-6 mb-2" />
              <span>CSV Export</span>
              <span className="text-xs text-muted-foreground">Spreadsheet format</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              className="h-20 flex-col"
            >
              <Award className="h-6 w-6 mb-2" />
              <span>PDF Report</span>
              <span className="text-xs text-muted-foreground">Formatted report</span>
            </Button>

            <Button
              variant="outline"
              disabled={isExporting}
              className="h-20 flex-col"
            >
              <BarChart3 className="h-6 w-6 mb-2" />
              <span>Analytics</span>
              <span className="text-xs text-muted-foreground">Advanced insights</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
