"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
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
import { useFormValidation } from "@/lib/hooks/use-form-validation"
import { validationRules } from "@/lib/validation"
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
import { format } from "date-fns"
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

export default function AssignmentBuilderPage() {
  const { data: session, status } = useSession()
  const { t } = useTranslation()
  const router = useRouter()
  
  const initialConfig = {
    name: "",
    documentId: "",
    testId: "",
    selectedUsers: [] as string[],
    dueDate: undefined as Date | undefined,
    description: ""
  } satisfies AssignmentConfig

  const validation = useFormValidation({
    name: [validationRules.required, validationRules.minLength(3), validationRules.maxLength(200)],
    documentId: [validationRules.required],
    selectedUsers: [validationRules.minItems(1)],
    description: [validationRules.optional(validationRules.maxLength(1000))],
    testId: [], // Optional
    dueDate: [validationRules.optional(validationRules.futureDate)] // Optional, but if provided must be future
  }, initialConfig)

  const assignmentConfig = validation.values
  const { setValue, setFieldTouched, validateAll, validateField, errors, touched } = validation
  
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

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Check if we're in edit mode via URL parameter
    const urlParams = new URLSearchParams(window.location.search)
    const editingId = urlParams.get('edit')
    if (editingId) {
      setIsEditMode(true)
      setEditingAssignmentId(editingId)
      loadAssignmentForEditing(editingId)
    }
  }, [session, status, router])

  const loadAssignmentForEditing = async (assignmentId: string) => {
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
        validation.setValues({
          name: assignment.title || `Assignment ${assignment.id.slice(0, 8)}`, // Use title if exists, otherwise ID
          documentId: documentId,
          testId: assignment.testId || '',
          selectedUsers: allUserIds, // Load all users with this assignment
          dueDate: assignment.dueDate ? new Date(assignment.dueDate) : undefined,
          description: assignment.description || '' // Load the actual description
        })
      }
    } catch (error) {
      console.error('Error loading assignment for editing:', error)
      setError('Failed to load assignment for editing')
    }
  }

  useEffect(() => {
    // Load tests from API
    const loadTests = async () => {
      try {
        const response = await fetch('/api/tests')
        const result = await response.json()
        if (result.success) {
          setSavedTests(result.data.tests)
        }
      } catch (error) {
        console.error('Error loading tests:', error)
      }
    }

    // Load users from API
    const loadUsers = async () => {
      try {
        const response = await fetch('/api/users')
        const result = await response.json()
        if (result.success) {
          setSavedUsers(result.data.users)
        }
      } catch (error) {
        console.error('Error loading users:', error)
      }
    }

    // Load documents from API
    const loadDocuments = async () => {
      try {
        const response = await fetch('/api/documents')
        const result = await response.json()
        if (result.success) {
          // Transform database documents to match the expected format
          const transformedDocs = result.data.documents.map((doc: {
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
            uploadedAt: new Date(doc.createdAt).toLocaleDateString(),
            size: doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown',
            status: doc.status || 'ready'
          }))
          setSavedDocuments(transformedDocs)
        }
      } catch (error) {
        console.error('Error loading documents:', error)
      }
    }

    loadTests()
    loadUsers()
    loadDocuments()
  }, [])

  const handleUserToggle = (userId: string) => {
    const newUsers = assignmentConfig.selectedUsers.includes(userId)
      ? assignmentConfig.selectedUsers.filter(id => id !== userId)
      : [...assignmentConfig.selectedUsers, userId]
    setValue('selectedUsers', newUsers)
    // Validate immediately after change if touched
    if (touched.selectedUsers) {
      validateField('selectedUsers')
    }
  }

  const handleSelectAllUsers = () => {
    const allUserIds = savedUsers.filter(user => user.role === 'employee').map(user => user.id)
    setValue('selectedUsers', allUserIds)
    if (touched.selectedUsers) {
      validateField('selectedUsers')
    }
  }

  const handleDeselectAllUsers = () => {
    setValue('selectedUsers', [])
    if (touched.selectedUsers) {
      validateField('selectedUsers')
    }
  }

  const handleCreateAssignment = async () => {
    // Validate all fields before submission
    if (!validateAll()) {
      setError("Please fix the errors below")
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
          {/* Configuration Panel */}
          <div className="space-y-3 md:space-y-6">
            {/* Assignment Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>{t('assignmentConfiguration')}</CardTitle>
                <CardDescription>{t('configureAssignmentParameters')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  label={t('assignmentName')}
                  required
                  error={touched.name ? errors.name : undefined}
                >
                  <Input
                    placeholder={t('enterAssignmentName')}
                    value={assignmentConfig.name}
                    onChange={(e) => setValue('name', e.target.value)}
                    onBlur={() => setFieldTouched('name')}
                    className="w-full"
                  />
                </FormField>

                <FormField
                  label={t('descriptionOptional')}
                  error={touched.description ? errors.description : undefined}
                >
                  <Input
                    placeholder={t('enterAssignmentDescription')}
                    value={assignmentConfig.description}
                    onChange={(e) => setValue('description', e.target.value)}
                    onBlur={() => setFieldTouched('description')}
                    className="w-full"
                  />
                </FormField>

                <FormField
                  label={t('selectDocument')}
                  required
                  error={touched.documentId ? errors.documentId : undefined}
                >
                  <Select 
                    value={assignmentConfig.documentId} 
                    onValueChange={(value) => {
                      setValue('documentId', value)
                      setFieldTouched('documentId')
                    }}
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
                    value={assignmentConfig.testId} 
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
                  error={touched.dueDate ? errors.dueDate : undefined}
                >
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-between text-left font-normal relative",
                          !assignmentConfig.dueDate && "text-muted-foreground",
                          touched.dueDate && errors.dueDate && "border-destructive"
                        )}
                        onClick={() => setFieldTouched('dueDate')}
                      >
                        <div className="flex items-center">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {assignmentConfig.dueDate ? format(assignmentConfig.dueDate, "PPP") : t('pickDate')}
                        </div>
                        {assignmentConfig.dueDate && (
                          <X 
                            className="h-4 w-4" 
                            onClick={(e) => {
                              e.stopPropagation()
                              setValue('dueDate', undefined)
                              setFieldTouched('dueDate')
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
                          setFieldTouched('dueDate')
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
                    disabled={isCreating || !validateAll()}
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
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <CardTitle>
                      {t('selectEmployees')} <span className="text-red-500">*</span>
                    </CardTitle>
                    <CardDescription>
                      {t('chooseEmployeesToAssign')}
                    </CardDescription>
                    {touched.selectedUsers && errors.selectedUsers && (
                      <p className="text-sm text-red-600 mt-1">{errors.selectedUsers}</p>
                    )}
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
                    <div key={user.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent">
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
                  <div className="mt-4 p-3 bg-primary/10 rounded-lg">
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
