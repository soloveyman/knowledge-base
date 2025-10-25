"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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

// Mock documents data - same as test builder
const mockDocuments = [
  { id: 1, name: "Ланч меню BS.docx", type: "DOCX", uploadedAt: "2 hours ago" },
  { id: 2, name: "Training Schedule.xlsx", type: "XLSX", uploadedAt: "1 day ago" },
  { id: 3, name: "Employee Handbook.docx", type: "DOCX", uploadedAt: "5 minutes ago" },
  { id: 4, name: "Safety Guidelines.pdf", type: "PDF", uploadedAt: "1 hour ago" }
]

// Mock users data
const mockUsers = [
  { id: 1, name: "Анна Иванова", email: "anna.ivanova@company.com", role: "Manager", department: "Operations" },
  { id: 2, name: "Петр Петров", email: "petr.petrov@company.com", role: "Employee", department: "Kitchen" },
  { id: 3, name: "Мария Сидорова", email: "maria.sidorova@company.com", role: "Employee", department: "Service" },
  { id: 4, name: "Алексей Козлов", email: "alexey.kozlov@company.com", role: "Employee", department: "Kitchen" },
  { id: 5, name: "Елена Морозова", email: "elena.morozova@company.com", role: "Employee", department: "Service" },
  { id: 6, name: "Дмитрий Волков", email: "dmitry.volkov@company.com", role: "Employee", department: "Management" },
  { id: 7, name: "Ольга Новикова", email: "olga.novikova@company.com", role: "Employee", department: "Kitchen" },
  { id: 8, name: "Сергей Лебедев", email: "sergey.lebedev@company.com", role: "Employee", department: "Service" }
]

interface AssignmentConfig {
  name: string
  documentId: string
  testId: string
  selectedUsers: number[]
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

    // Check if we're in edit mode
    const editingId = localStorage.getItem('editingAssignmentId')
    if (editingId) {
      setIsEditMode(true)
      setEditingAssignmentId(editingId)
      loadAssignmentForEditing(editingId)
      // Clear the editing ID from localStorage
      localStorage.removeItem('editingAssignmentId')
    }
  }, [session, status, router])

  const loadAssignmentForEditing = (assignmentId: string) => {
    try {
      const savedAssignments = JSON.parse(localStorage.getItem('savedAssignments') || '[]')
      const assignmentToEdit = savedAssignments.find((assignment: any) => assignment.id === assignmentId)
      
      if (assignmentToEdit) {
        // Load assignment configuration
        setAssignmentConfig({
          name: assignmentToEdit.name,
          documentId: assignmentToEdit.document.id.toString(),
          testId: assignmentToEdit.test.id,
          selectedUsers: assignmentToEdit.assignedUsers.map((user: any) => user.id),
          dueDate: new Date(assignmentToEdit.dueDate),
          description: assignmentToEdit.description || ""
        })
      }
    } catch (error) {
      console.error('Error loading assignment for editing:', error)
      setError('Failed to load assignment for editing')
    }
  }

  useEffect(() => {
    // Load saved tests from localStorage
    const tests = JSON.parse(localStorage.getItem('savedTests') || '[]')
    setSavedTests(tests)
  }, [])

  const handleUserToggle = (userId: number) => {
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
      selectedUsers: mockUsers.map(user => user.id)
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
      const selectedDocument = mockDocuments.find(doc => doc.id.toString() === assignmentConfig.documentId)
      const selectedTest = savedTests.find(test => test.id === assignmentConfig.testId)
      const selectedUsersData = mockUsers.filter(user => assignmentConfig.selectedUsers.includes(user.id))

      const existingAssignments = JSON.parse(localStorage.getItem('savedAssignments') || '[]')

      if (isEditMode && editingAssignmentId) {
        // Update existing assignment
        const assignmentData = {
          id: editingAssignmentId,
          name: assignmentConfig.name,
          description: assignmentConfig.description,
          document: selectedDocument,
          test: selectedTest,
          assignedUsers: selectedUsersData,
          dueDate: assignmentConfig.dueDate.toISOString(),
          createdAt: existingAssignments.find((a: any) => a.id === editingAssignmentId)?.createdAt || new Date().toISOString(),
          createdBy: session?.user?.name || 'Unknown',
          status: 'active'
        }

        const updatedAssignments = existingAssignments.map((assignment: any) => 
          assignment.id === editingAssignmentId ? assignmentData : assignment
        )
        localStorage.setItem('savedAssignments', JSON.stringify(updatedAssignments))

        alert(`Assignment updated successfully! Assigned to ${selectedUsersData.length} employees.`)
      } else {
        // Create new assignment
        const assignmentData = {
          id: Date.now().toString(),
          name: assignmentConfig.name,
          description: assignmentConfig.description,
          document: selectedDocument,
          test: selectedTest,
          assignedUsers: selectedUsersData,
          dueDate: assignmentConfig.dueDate.toISOString(),
          createdAt: new Date().toISOString(),
          createdBy: session?.user?.name || 'Unknown',
          status: 'active'
        }

        existingAssignments.push(assignmentData)
        localStorage.setItem('savedAssignments', JSON.stringify(existingAssignments))

        alert(`Assignment created successfully! Assigned to ${selectedUsersData.length} employees.`)
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
              <ClipboardList className="h-8 w-8 text-blue-600 mr-3 shrink-0" />
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
                      {mockDocuments.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id.toString()}>
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4" />
                            <span>{doc.name}</span>
                            <Badge variant="outline" className="ml-2">{doc.type}</Badge>
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
                              <Badge variant="outline" className="ml-2">{test.questionCount} questions</Badge>
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
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <p className="text-red-600">{error}</p>
                </CardContent>
              </Card>
            )}

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
                      disabled={assignmentConfig.selectedUsers.length === mockUsers.length}
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
                  {mockUsers.map((user) => (
                    <div key={user.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={assignmentConfig.selectedUsers.includes(user.id)}
                        onCheckedChange={() => handleUserToggle(user.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-gray-400" />
                          <label
                            htmlFor={`user-${user.id}`}
                            className="text-sm font-medium text-gray-900 cursor-pointer"
                          >
                            {user.name}
                          </label>
                        </div>
                        <p className="text-xs text-gray-500">{user.email}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {user.role}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {user.department}
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
