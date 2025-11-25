"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTranslation } from "@/lib/translation-context"
import { FormField } from "@/components/common/form-field"
import { toast } from "sonner"
import { 
  FileText, 
  X,
  ClipboardList,
  Loader2,
  Calendar as CalendarIcon,
  TestTube,
  Check,
  RotateCcw
} from "lucide-react"
import { formatDatePretty, formatDateShort } from "@/lib/date-format"
import { cn } from "@/lib/utils"

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

interface AssignmentConfig {
  name: string
  documentId: string
  testId: string
  selectedUsers: string[]
  dueDate: Date | undefined
  description: string
}

interface SavedTest {
  id: string
  title: string
  type: string
  difficulty: string
  locale: string
  questionCount: number
  questions: Array<{
    id: string
    type: string
    prompt: string
    choices?: string[]
    correct_answer?: string
    explanation?: string
  }>
  sourceDocument: string
  createdAt: string
  createdBy: string
}

interface User {
  id: string
  name: string
  email: string
  role: string
  job: string
  department?: string
}

interface Document {
  id: string
  originalFileName?: string
  title: string
  fileType?: string
  createdAt: string
  fileSize?: number
  status?: string
}

interface AssignmentBuilderClientProps {
  initialAssignmentData: {
    name: string
    documentId: string
    testId: string
    selectedUsers: string[]
    dueDate: Date | undefined
    description: string
  } | null
  initialTests: SavedTest[]
  initialUsers: User[]
  initialDocuments: Document[]
  editingId: string | null
  returnTo: string | null
}

export default function AssignmentBuilderClient({
  initialAssignmentData,
  initialTests,
  initialUsers,
  initialDocuments,
  editingId,
  returnTo
}: AssignmentBuilderClientProps) {
  const { data: session, status } = useSession()
  const { t } = useTranslation()
  const router = useRouter()
  
  // Transform documents to match expected format
  const transformedDocuments = useMemo(() => {
    return initialDocuments.map((doc) => ({
      id: doc.id,
      name: doc.originalFileName || doc.title,
      type: doc.fileType?.toUpperCase() || 'UNKNOWN',
      uploadedAt: formatDateShort(doc.createdAt),
      size: doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown',
      status: doc.status || 'ready'
    }))
  }, [initialDocuments])

  // Simple state management
  const [assignmentConfig, setAssignmentConfig] = useState<AssignmentConfig>({
    name: "",
    documentId: "",
    testId: "",
    selectedUsers: [],
    dueDate: undefined,
    description: ""
  })
  
  const [originalAssignmentData, setOriginalAssignmentData] = useState<AssignmentConfig | null>(null)
  
  // Helper to update a single field
  const setValue = useCallback((field: keyof AssignmentConfig, value: AssignmentConfig[keyof AssignmentConfig]) => {
    setAssignmentConfig(prev => ({ ...prev, [field]: value }))
  }, [])
  
  // Helper to update multiple fields
  const setValues = useCallback((newValues: Partial<AssignmentConfig>) => {
    setAssignmentConfig(prev => ({ ...prev, ...newValues }))
  }, [])

  const [savedTests, setSavedTests] = useState<SavedTest[]>(initialTests)
  const [savedUsers, setSavedUsers] = useState<User[]>(initialUsers)
  const [savedDocuments, setSavedDocuments] = useState(transformedDocuments)
  const [isCreating, setIsCreating] = useState(false)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(!!editingId)
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(editingId)

  // Initialize form with server-provided data
  useEffect(() => {
    if (initialAssignmentData) {
      setValues(initialAssignmentData)
      setOriginalAssignmentData(initialAssignmentData)
      setIsEditMode(true)
      setEditingAssignmentId(editingId)
    }
  }, [initialAssignmentData, editingId, setValues])

  // Restore original data function
  const restoreOriginalData = useCallback(() => {
    if (originalAssignmentData) {
      setValues(originalAssignmentData)
    }
  }, [originalAssignmentData, setValues])

  // Handle auth check
  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }
  }, [session, status, router])

  const handleUserToggle = (userId: string) => {
    const newUsers = assignmentConfig.selectedUsers.includes(userId)
      ? assignmentConfig.selectedUsers.filter(id => id !== userId)
      : [...assignmentConfig.selectedUsers, userId]
    setValue('selectedUsers', newUsers)
  }

  const handleSelectAllUsers = () => {
    const allUserIds = savedUsers.filter(user => user.role === 'employee').map(user => user.id)
    setValue('selectedUsers', allUserIds)
  }

  const handleDeselectAllUsers = () => {
    setValue('selectedUsers', [])
  }

  const handleCreateAssignment = async () => {
    // Basic validation - check required fields
    if (!assignmentConfig.name.trim() || !assignmentConfig.documentId || assignmentConfig.selectedUsers.length === 0) {
      toast.error("Please fill in all required fields", {
        duration: 5000
      })
      return
    }

    setIsCreating(true)

    try {
      if (isEditMode && editingAssignmentId) {
        // Update existing assignment
        const updateData: Record<string, unknown> = {
          moduleId: assignmentConfig.documentId,
          assignedTo: assignmentConfig.selectedUsers,
          title: assignmentConfig.name,
          description: assignmentConfig.description,
          status: 'pending',
          testId: assignmentConfig.testId || null,
          dueDate: assignmentConfig.dueDate ? assignmentConfig.dueDate.toISOString() : null
        }
        
        const response = await fetch(`/api/assignments/${editingAssignmentId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to update assignment')
        }

        const result = await response.json()
        const addedCount = result.data?.addedCount || 0
        const removedCount = result.data?.removedCount || 0
        
        if (addedCount > 0 || removedCount > 0) {
          toast.success(result.message || 'Assignment updated successfully')
        } else {
          toast.success('Assignment updated successfully')
        }
        
        // Fetch assignments immediately after update to refresh the list
        try {
          const assignmentsResponse = await fetch('/api/assignments', { cache: 'no-store' })
          const assignmentsResult = await assignmentsResponse.json()
          if (assignmentsResult.success && typeof window !== 'undefined') {
            sessionStorage.setItem('pendingAssignmentsRefresh', JSON.stringify({
              data: assignmentsResult.data.assignments,
              timestamp: Date.now(),
              editedAssignmentId: editingAssignmentId, // Mark this as an edit operation
              trigger: 'assignment_updated' // Also mark for employees
            }))
          }
        } catch (error) {
          console.error('Failed to fetch assignments after update:', error)
        }
      } else {
        // Create new assignment
        const assignmentData: Record<string, unknown> = {
          moduleId: assignmentConfig.documentId,
          assignedTo: assignmentConfig.selectedUsers,
          title: assignmentConfig.name,
          description: assignmentConfig.description,
          status: 'pending'
        }
        
        if (assignmentConfig.testId) {
          assignmentData.testId = assignmentConfig.testId
        }
        if (assignmentConfig.dueDate) {
          assignmentData.dueDate = assignmentConfig.dueDate.toISOString()
        }
        
        const response = await fetch('/api/assignments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(assignmentData)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to create assignment')
        }

        const result = await response.json()
        const assignmentCount = result.data?.count || assignmentConfig.selectedUsers.length
        const skippedCount = result.data?.skippedCount || 0
        
        if (skippedCount > 0) {
          toast.success(`Created ${assignmentCount} new assignment(s). ${skippedCount} user(s) already had this assignment.`)
        } else {
          toast.success(`Successfully created ${assignmentCount} assignment(s)!`)
        }
        
        // Fetch assignments immediately after save
        try {
          const assignmentsResponse = await fetch('/api/assignments', { cache: 'no-store' })
          const assignmentsResult = await assignmentsResponse.json()
          if (assignmentsResult.success && typeof window !== 'undefined') {
            sessionStorage.setItem('pendingAssignmentsRefresh', JSON.stringify({
              data: assignmentsResult.data.assignments,
              timestamp: Date.now(),
              trigger: 'assignment_created' // Also mark for employees
            }))
          }
        } catch (error) {
          console.error('Failed to fetch assignments after save:', error)
        }
      }
      
      // Redirect based on returnTo parameter or user role
      const addTimestamp = (url: string) => {
        return url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`
      }
      
      const userRole = session?.user?.role
      const redirectUrl = returnTo 
        ? addTimestamp(returnTo)
        : (userRole === 'owner' || userRole === 'super-admin'
            ? addTimestamp('/owner?tab=assignments')
            : addTimestamp('/manager?tab=assignments'))
      
      router.replace(redirectUrl)
      router.refresh()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create assignment'
      toast.error(errorMessage, {
        duration: 5000
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    const addTimestamp = (url: string) => {
      return url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`
    }
    
    if (returnTo) {
      router.replace(addTimestamp(returnTo))
    } else {
      const userRole = session?.user?.role
      if (userRole === 'owner' || userRole === 'super-admin') {
        router.replace(addTimestamp('/owner?tab=assignments'))
      } else {
        router.replace(addTimestamp('/manager?tab=assignments'))
      }
    }
    router.refresh()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('popstate'))
      window.dispatchEvent(new Event('locationchange'))
    }
  }

  if (status === "loading") {
    return null
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 min-w-0">
              <Image
                src="/Uppstaff_logo.svg"
                alt="Logo"
                width={38}
                height={38}
                className="object-contain flex-shrink-0"
                priority
              />
              <h1 className="text-lg sm:text-xl font-semibold text-foreground dark:text-white truncate">
                {isEditMode ? t('editAssignment') : t('assignmentBuilder')}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
          {/* Configuration Panel */}
          <div className="space-y-3 md:space-y-6">
            {/* Assignment Configuration */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle><span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">📝</span> <span className="leading-none self-center">{t('assignmentConfiguration')}</span></CardTitle>
                  <CardDescription>{t('configureAssignmentParameters')}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  label={t('assignmentName')}
                  required
                >
                  <Input
                    placeholder={t('enterAssignmentName')}
                    value={assignmentConfig.name}
                    onChange={(e) => setValue('name', e.target.value)}
                    className="w-full"
                  />
                </FormField>

                <FormField
                  label={t('descriptionOptional')}
                >
                  <Input
                    placeholder={t('enterAssignmentDescription')}
                    value={assignmentConfig.description}
                    onChange={(e) => setValue('description', e.target.value)}
                    className="w-full"
                  />
                </FormField>

                <FormField
                  label={t('selectDocument')}
                  required
                >
                  <Select 
                    value={assignmentConfig.documentId} 
                    onValueChange={(value) => setValue('documentId', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('chooseDocument')} />
                    </SelectTrigger>
                    <SelectContent>
                      {savedDocuments.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">{t('noItems') || 'No items available'}</div>
                      ) : (
                        savedDocuments.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4" />
                              <span>{doc.name}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  label={t('selectTestOptional')}
                >
                  <Select 
                    value={assignmentConfig.testId || ""} 
                    onValueChange={(value) => setValue('testId', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('chooseTest')} />
                    </SelectTrigger>
                    <SelectContent>
                      {savedTests.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">{t('noItems') || 'No items available'}</div>
                      ) : (
                        savedTests.map((test) => (
                          <SelectItem key={test.id} value={test.id}>
                            <div className="flex items-center space-x-2">
                              <TestTube className="h-4 w-4" />
                              <span>{test.title}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  label={t('dueDateOptional')}
                >
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-between text-left font-normal relative",
                          !assignmentConfig.dueDate && "text-muted-foreground"
                        )}
                      >
                        <div className="flex items-center">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {assignmentConfig.dueDate ? formatDatePretty(assignmentConfig.dueDate) : t('pickDate')}
                        </div>
                        {assignmentConfig.dueDate && (
                          <X 
                            className="h-4 w-4" 
                            onClick={(e) => {
                              e.stopPropagation()
                              setValue('dueDate', undefined)
                            }}
                          />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 max-w-[calc(100vw-2rem)] sm:max-w-none" align="start">
                      <Calendar
                        mode="single"
                        selected={assignmentConfig.dueDate}
                        onSelect={(date) => {
                          setValue('dueDate', date)
                          setIsCalendarOpen(false)
                        }}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </FormField>

                <div className="pt-4 space-y-2">
                  {isEditMode && originalAssignmentData && (
                    <Button
                      type="button"
                      onClick={restoreOriginalData}
                      variant="outline"
                      className="w-full"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {t('reset') || 'Reset to Original'}
                    </Button>
                  )}
                  <Button 
                    onClick={handleCreateAssignment}
                    disabled={isCreating || !assignmentConfig.name.trim() || !assignmentConfig.documentId || assignmentConfig.selectedUsers.length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('loading')}...
                      </>
                    ) : (
                      <>
                        <ClipboardList className="h-4 w-4 mr-2" />
                        {isEditMode ? t('editAssignment') : t('createAssignment')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Employee Selection Panel */}
          <div className="space-y-3 md:space-y-6">

            <Card>
              <CardHeader>
                <div className="space-y-4">
                  <div>
                    <CardTitle>
                      <span className="text-red-500 mr-1">👥</span> {t('selectEmployees')}
                    </CardTitle>
                    <CardDescription>
                      {t('chooseEmployeesToAssign')}
                    </CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllUsers}
                      disabled={assignmentConfig.selectedUsers.length === savedUsers.filter(user => user.role === 'employee').length}
                    >
                      {t('selectAll')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeselectAllUsers}
                      disabled={assignmentConfig.selectedUsers.length === 0}
                    >
                      {t('deselectAll')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {savedUsers.filter(user => user.role === 'employee').map((user) => (
                    <div key={user.id} className="flex items-center space-x-3 p-3 border rounded-3xl hover:bg-accent">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={assignmentConfig.selectedUsers.includes(user.id)}
                        onCheckedChange={() => handleUserToggle(user.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <label
                            htmlFor={`user-${user.id}`}
                            className="text-sm font-medium text-foreground cursor-pointer"
                          >
                            {user.name}
                          </label>
                          <Badge variant="secondary" className="text-xs">
                            {user.job}
                          </Badge>
                        </div>
                      </div>
                      {assignmentConfig.selectedUsers.includes(user.id) && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                  ))}
                </div>
                
                {assignmentConfig.selectedUsers.length > 0 && (
                  <div className="mt-4 p-3 bg-primary/10 rounded-3xl">
                    <p className="text-sm text-primary-700 dark:text-primary-300 font-medium">
                      <strong className="font-semibold">{assignmentConfig.selectedUsers.length}</strong> employee(s) selected
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

