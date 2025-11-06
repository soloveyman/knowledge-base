"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Image from "next/image"
import { useEffect, useState, useCallback, useRef, useMemo, Suspense, useLayoutEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RoleBadge } from "@/lib/badges"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ErrorMessage } from "@/components/common/error-message"
import { useTranslation } from "@/lib/translation-context"
import { FormField } from "@/components/common/form-field"
import { toast } from "sonner"
import { 
  FileText, 
  X,
  ClipboardList,
  Loader2,
  Users,
  Calendar as CalendarIcon,
  TestTube,
  Save,
  Check
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
  department: string
}

interface Assignment {
  id: string
  name: string
  description: string
  document: {
    id: number
    name: string
    type: string
    uploadedAt: string
  }
  test: {
    id: string
    title: string
    questionCount: number
  }
  assignedUsers: User[]
  dueDate: string
  createdAt: string
  createdBy: string
  status: string
}

function AssignmentBuilderPageContent() {
  const sessionResult = useSession()
  const { data: session, status } = sessionResult || { data: null, status: 'loading' }
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  // Simple state management - no validation hook
  const [assignmentConfig, setAssignmentConfig] = useState<AssignmentConfig>({
    name: "",
    documentId: "",
    testId: "",
    selectedUsers: [],
    dueDate: undefined,
    description: ""
  })
  
  // Helper to update a single field
  const setValue = useCallback((field: keyof AssignmentConfig, value: AssignmentConfig[keyof AssignmentConfig]) => {
    setAssignmentConfig(prev => ({ ...prev, [field]: value }))
  }, [])
  
  // Helper to update multiple fields
  const setValues = useCallback((newValues: Partial<AssignmentConfig>) => {
    setAssignmentConfig(prev => ({ ...prev, ...newValues }))
  }, [])
  
  
  const [savedTests, setSavedTests] = useState<SavedTest[]>([])
  const [savedUsers, setSavedUsers] = useState<User[]>([])
  const [savedDocuments, setSavedDocuments] = useState<Array<{
    id: string
    name: string
    type: string
    uploadedAt: string
    size?: string
    status?: string
  }>>([])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null)
  const hasLoadedAssignmentRef = useRef(false)
  const lastEditingIdRef = useRef<string | null>(null)

  const loadAssignmentForEditingRef = useRef<((assignmentId: string) => Promise<void>) | null>(null)
  
  // Store the latest loadAssignmentForEditing function in a ref
  const loadAssignmentForEditing = useCallback(async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/assignments/${assignmentId}`)
      const result = await response.json()
      
      if (result.success && result.data.assignment) {
        const assignment = result.data.assignment
        const users = result.data.users || []
        
        interface UserWithAssignmentId {
          userId?: string
          id?: string
        }
        
        // Get all user IDs from assignmentUsers
        const allUserIds = (users as UserWithAssignmentId[]).map((u: UserWithAssignmentId) => u.userId || u.id).filter(Boolean) as string[]
        
        // Find the document that has this moduleId
        let documentId = ''
        try {
          const docsResponse = await fetch('/api/documents')
          const docsResult = await docsResponse.json()
          if (docsResult.success) {
            interface ApiDoc {
              id: string | number
              moduleId?: string | null
            }
            const doc = (docsResult.data.documents as ApiDoc[]).find((d: ApiDoc) => d.moduleId === assignment.moduleId)
            documentId = doc ? String(doc.id) : ''
          }
        } catch (err) {
          console.error('Error fetching documents:', err)
        }
        
        // Load assignment configuration
        if (process.env.NODE_ENV === 'development') {
          console.log('[AssignmentBuilder] loadAssignmentForEditing: Calling setValues', {
            assignmentId,
            name: assignment.title || `Assignment ${assignment.id.slice(0, 8)}`,
            documentId,
            testId: assignment.testId || '',
            selectedUsersCount: allUserIds.length
          })
        }
        setValues({
          name: assignment.title || `Assignment ${assignment.id.slice(0, 8)}`, // Use title if exists, otherwise ID
          documentId: documentId,
          testId: assignment.testId || '',
          selectedUsers: allUserIds, // Load all users with this assignment
          dueDate: assignment.dueDate ? new Date(assignment.dueDate) : undefined,
          description: assignment.description || '' // Load the actual description
        })
        hasLoadedAssignmentRef.current = true
        if (process.env.NODE_ENV === 'development') {
          console.log('[AssignmentBuilder] loadAssignmentForEditing: setValues completed')
        }
      }
    } catch (error) {
      console.error('Error loading assignment for editing:', error)
      setError('Failed to load assignment for editing')
    }
  }, [setValues, pathname])

  // Store the latest function in the ref - use useEffect to avoid render-phase side effects
  useEffect(() => {
    loadAssignmentForEditingRef.current = loadAssignmentForEditing
  }, [loadAssignmentForEditing])

  // Handle auth check
  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }
  }, [session, status, router])

  // Memoize editingId to prevent unnecessary effect runs
  const editingId = useMemo(() => searchParams.get('edit'), [searchParams])

  // Handle edit mode - track URL changes
  useEffect(() => {
    if (status === "loading") {
      return
    }
    if (!session) {
      return
    }
    
    // Only process if editingId value actually changed
    if (editingId === lastEditingIdRef.current) {
      return
    }
    
    const previousEditingId = lastEditingIdRef.current
    lastEditingIdRef.current = editingId
    
    // Check if we're in edit mode via URL parameter
    if (editingId) {
      // Only load if we haven't loaded this assignment yet or it's a different assignment
      if (!hasLoadedAssignmentRef.current || previousEditingId !== editingId) {
        hasLoadedAssignmentRef.current = true
        setIsEditMode(true)
        setEditingAssignmentId(editingId)
        if (loadAssignmentForEditingRef.current) {
          loadAssignmentForEditingRef.current(editingId)
        }
      }
    } else if (previousEditingId) {
      // Reset edit mode if no edit parameter
      hasLoadedAssignmentRef.current = false
      setIsEditMode(false)
      setEditingAssignmentId(null)
    }
  }, [session, status, pathname, editingId]) // Use memoized editingId

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    
    // Load all data in parallel for faster loading
    const loadData = async () => {
      try {
        const [testsResponse, usersResponse, documentsResponse] = await Promise.all([
          fetch('/api/tests', { cache: 'no-store' }),
          fetch('/api/users', { cache: 'no-store' }),
          fetch('/api/documents', { cache: 'no-store' })
        ])

        // Process tests
        const testsResult = await testsResponse.json()
        if (testsResult.success) {
          setSavedTests(testsResult.data.tests)
        }

        // Process users
        const usersResult = await usersResponse.json()
        if (usersResult.success) {
          setSavedUsers(usersResult.data.users)
        }

        // Process documents
        const documentsResult = await documentsResponse.json()
        if (documentsResult.success) {
          // Transform database documents to match the expected format
          const transformedDocs = documentsResult.data.documents.map((doc: {
            id: string
            originalFileName?: string
            title: string
            fileType?: string
            createdAt: string
            fileSize?: number
            status?: string
          }) => ({
            id: doc.id,
            name: doc.originalFileName || doc.title,
            type: doc.fileType?.toUpperCase() || 'UNKNOWN',
            uploadedAt: formatDateShort(doc.createdAt),
            size: doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown',
            status: doc.status || 'ready'
          }))
          setSavedDocuments(transformedDocs)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }

    loadData()
  }, [])

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
      setError("Please fill in all required fields")
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      if (isEditMode && editingAssignmentId) {
        // Update existing assignment
        const updateData: Record<string, unknown> = {
          moduleId: assignmentConfig.documentId,
          assignedTo: assignmentConfig.selectedUsers, // Send all selected users
          title: assignmentConfig.name, // Send the custom title
          description: assignmentConfig.description, // Send the description
          status: 'pending',
          // Always include optional fields (send null to clear)
          testId: assignmentConfig.testId || null,
          dueDate: assignmentConfig.dueDate ? assignmentConfig.dueDate.toISOString() : null
        }
        console.log('Assignment Builder: Updating assignment with data:', updateData)
        console.log('Assignment Builder: Assignment ID:', editingAssignmentId)
        console.log('Assignment Builder: URL:', `/api/assignments/${editingAssignmentId}`)
        
        const response = await fetch(`/api/assignments/${editingAssignmentId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Assignment Builder: API Error Response:', errorData)
          console.error('Assignment Builder: Response Status:', response.status)
          throw new Error(errorData.message || 'Failed to update assignment')
        }

        const result = await response.json()
        const assignmentCount = result.data?.count || assignmentConfig.selectedUsers.length
        const skippedCount = result.data?.skippedCount || 0
        
        if (skippedCount > 0) {
          toast.success(`Updated ${assignmentCount} assignment(s). ${skippedCount} user(s) already had this assignment.`)
        } else {
          toast.success(`Successfully updated ${assignmentCount} assignment(s)!`)
        }
      } else {
        // Create new assignment
        const assignmentData: Record<string, unknown> = {
          moduleId: assignmentConfig.documentId,
          assignedTo: assignmentConfig.selectedUsers, // Send all selected users
          title: assignmentConfig.name, // Send the custom title
          description: assignmentConfig.description, // Send the description
          status: 'pending'
        }
        
        // Add optional fields if provided
        if (assignmentConfig.testId) {
          assignmentData.testId = assignmentConfig.testId
        }
        if (assignmentConfig.dueDate) {
          assignmentData.dueDate = assignmentConfig.dueDate.toISOString()
        }
        
        console.log('Creating assignment with data:', assignmentData)
        
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
      }
      
      // Redirect based on returnTo parameter or user role
      const urlParams = new URLSearchParams(window.location.search)
      const returnTo = urlParams.get('returnTo')
      if (returnTo) {
        router.push(returnTo)
      } else {
        // Fallback: redirect based on user role
        const userRole = session?.user?.role
        if (userRole === 'owner') {
          router.push('/owner?tab=assignments')
        } else {
          router.push('/manager?tab=assignments')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assignment')
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    // Redirect based on returnTo parameter or user role
    const urlParams = new URLSearchParams(window.location.search)
    const returnTo = urlParams.get('returnTo')
    if (returnTo) {
      router.push(returnTo)
    } else {
      // Fallback: redirect based on user role
      const userRole = session?.user?.role
      if (userRole === 'owner') {
        router.push('/owner?tab=assignments')
      } else {
        router.push('/manager?tab=assignments')
      }
    }
  }

  // Don't block UI while session loads - show page immediately
  if (status === "loading") {
    // Show page but with disabled state - don't block with spinner
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
                {isEditMode ? t('edit') + ' ' + t('assignmentManagement') : t('assignmentBuilder')}
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
                      {savedDocuments.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4" />
                            <span>{doc.name}</span>
                          </div>
                        </SelectItem>
                      ))}
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
                        <div className="p-2 text-sm text-muted-foreground">No tests available. Create a test first.</div>
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

                <div className="pt-4">
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
                        {isEditMode ? t('edit') + ' ' + t('assignmentManagement') : t('createAssignment')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Employee Selection Panel */}
          <div className="space-y-3 md:space-y-6">
            <ErrorMessage error={error} />

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

export default function AssignmentBuilderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    }>
      <AssignmentBuilderPageContent />
    </Suspense>
  )
}
