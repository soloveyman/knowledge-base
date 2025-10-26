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
  id: number
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
  const router = useRouter()
  
  const [assignmentConfig, setAssignmentConfig] = useState<AssignmentConfig>({
    name: "",
    documentId: "",
    testId: "",
    selectedUsers: [],
    dueDate: undefined,
    description: ""
  })
  
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
        
        // Load assignment configuration
        setAssignmentConfig({
          name: `Assignment ${assignment.id.slice(0, 8)}`, // Generate name from ID
          documentId: assignment.moduleId || '', // Use moduleId as documentId for now
          testId: assignment.testId || '',
          selectedUsers: assignment.assignedTo ? [assignment.assignedTo] : [],
          dueDate: assignment.dueDate ? new Date(assignment.dueDate) : undefined,
          description: `Assignment created on ${new Date(assignment.createdAt).toLocaleDateString()}`
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
    setAssignmentConfig(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userId)
        ? prev.selectedUsers.filter(id => id !== userId)
        : [...prev.selectedUsers, userId]
    }))
  }

  const handleSelectAllUsers = () => {
    setAssignmentConfig(prev => ({
      ...prev,
      selectedUsers: savedUsers.filter(user => user.role === 'employee').map(user => user.id)
    }))
  }

  const handleDeselectAllUsers = () => {
    setAssignmentConfig(prev => ({
      ...prev,
      selectedUsers: []
    }))
  }

  const handleCreateAssignment = async () => {
    if (!assignmentConfig.name.trim()) {
      setError("Please enter assignment name")
      return
    }

    if (!assignmentConfig.documentId) {
      setError("Please select a document")
      return
    }

    if (!assignmentConfig.testId) {
      setError("Please select a test")
      return
    }

    if (assignmentConfig.selectedUsers.length === 0) {
      setError("Please select at least one employee")
      return
    }

    if (!assignmentConfig.dueDate) {
      setError("Please select a due date")
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      if (isEditMode && editingAssignmentId) {
        // Update existing assignment
        const response = await fetch(`/api/assignments/${editingAssignmentId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: assignmentConfig.name,
            description: assignmentConfig.description,
            moduleId: assignmentConfig.documentId,
            testId: assignmentConfig.testId,
            assignedTo: assignmentConfig.selectedUsers[0], // For now, assign to first user
            dueDate: assignmentConfig.dueDate.toISOString(),
            status: 'pending'
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to update assignment')
        }

        alert(`Assignment updated successfully!`)
      } else {
        // Create new assignment
        const assignmentData = {
          name: assignmentConfig.name,
          description: assignmentConfig.description,
          moduleId: assignmentConfig.documentId,
          testId: assignmentConfig.testId,
          assignedTo: assignmentConfig.selectedUsers[0], // For now, assign to first user
          dueDate: assignmentConfig.dueDate.toISOString(),
          status: 'pending'
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

        alert(`Assignment created successfully!`)
      }
      
      // Redirect to manager assignments tab
      router.push('/manager?tab=assignments')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assignment')
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    router.push('/manager?tab=assignments')
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                {isEditMode ? 'Edit Assignment' : 'Assignment Builder'}
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Panel */}
          <div className="space-y-6">
            {/* Assignment Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Assignment Configuration</CardTitle>
                <CardDescription>Configure your assignment parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="assignment-name">Assignment Name</Label>
                  <Input
                    id="assignment-name"
                    placeholder="Enter assignment name..."
                    value={assignmentConfig.name}
                    onChange={(e) => setAssignmentConfig(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <Label htmlFor="assignment-description">Description (Optional)</Label>
                  <Input
                    id="assignment-description"
                    placeholder="Enter assignment description..."
                    value={assignmentConfig.description}
                    onChange={(e) => setAssignmentConfig(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <Label htmlFor="document-select">Select Document</Label>
                  <Select 
                    value={assignmentConfig.documentId} 
                    onValueChange={(value) => setAssignmentConfig(prev => ({ ...prev, documentId: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a document..." />
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
                </div>

                <div>
                  <Label htmlFor="test-select">Select Test</Label>
                  <Select 
                    value={assignmentConfig.testId} 
                    onValueChange={(value) => setAssignmentConfig(prev => ({ ...prev, testId: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a test..." />
                    </SelectTrigger>
                    <SelectContent>
                      {savedTests.length === 0 ? (
                        <div className="p-2 text-sm text-gray-500">No tests available. Create a test first.</div>
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
                </div>

                <div>
                  <Label>Due Date</Label>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !assignmentConfig.dueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {assignmentConfig.dueDate ? format(assignmentConfig.dueDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={assignmentConfig.dueDate}
                        onSelect={(date) => {
                          setAssignmentConfig(prev => ({ ...prev, dueDate: date }))
                          setIsCalendarOpen(false)
                        }}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="pt-4">
                  <Button 
                    onClick={handleCreateAssignment}
                    disabled={isCreating || !assignmentConfig.name || !assignmentConfig.documentId || !assignmentConfig.testId || assignmentConfig.selectedUsers.length === 0 || !assignmentConfig.dueDate}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating Assignment...
                      </>
                    ) : (
                      <>
                        <ClipboardList className="h-4 w-4 mr-2" />
                        {isEditMode ? 'Update Assignment' : 'Create Assignment'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Employee Selection Panel */}
          <div className="space-y-6">
            <ErrorMessage error={error} />

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <CardTitle>Select Employees</CardTitle>
                    <CardDescription>
                      Choose employees to assign this task to
                    </CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllUsers}
                      disabled={assignmentConfig.selectedUsers.length === savedUsers.filter(user => user.role === 'employee').length}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeselectAllUsers}
                      disabled={assignmentConfig.selectedUsers.length === 0}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {savedUsers.filter(user => user.role === 'employee').map((user) => (
                    <div key={user.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={assignmentConfig.selectedUsers.includes(user.id)}
                        onCheckedChange={() => handleUserToggle(user.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <label
                            htmlFor={`user-${user.id}`}
                            className="text-sm font-medium text-gray-900 cursor-pointer"
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
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>{assignmentConfig.selectedUsers.length}</strong> employee(s) selected
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
