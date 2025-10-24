"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Users, 
  User, 
  Calendar, 
  Clock, 
  Target,
  Send,
  Plus,
  X,
  Search,
  Filter,
  CheckCircle,
  AlertCircle
} from "lucide-react"

interface User {
  id: string
  name: string
  email: string
  role: 'employee' | 'manager'
  avatar?: string
}

interface Group {
  id: string
  name: string
  description: string
  memberCount: number
}

interface Module {
  id: string
  title: string
  description: string
  type: 'module' | 'test'
  duration?: number
  status: 'draft' | 'published'
}

interface AssignmentData {
  moduleId: string
  assignedTo: string[] // User IDs
  groupIds: string[]
  dueDate: string
  allowRetake: boolean
  maxAttempts: number
  message: string
  priority: 'low' | 'medium' | 'high'
}

interface AssignmentCreatorProps {
  onSave?: (assignment: AssignmentData) => void
  onCancel?: () => void
}

export default function AssignmentCreator({ onSave, onCancel }: AssignmentCreatorProps) {
  const [assignmentData, setAssignmentData] = useState<AssignmentData>({
    moduleId: '',
    assignedTo: [],
    groupIds: [],
    dueDate: '',
    allowRetake: false,
    maxAttempts: 1,
    message: '',
    priority: 'medium'
  })

  const [selectedModule, setSelectedModule] = useState<Module | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showUserSelection, setShowUserSelection] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  // Mock data - in production, this would come from API
  const [users] = useState<User[]>([
    { id: '1', name: 'John Doe', email: 'john@example.com', role: 'employee' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'employee' },
    { id: '3', name: 'Mike Johnson', email: 'mike@example.com', role: 'employee' },
    { id: '4', name: 'Sarah Wilson', email: 'sarah@example.com', role: 'employee' },
    { id: '5', name: 'Tom Brown', email: 'tom@example.com', role: 'employee' }
  ])

  const [groups] = useState<Group[]>([
    { id: '1', name: 'Kitchen Staff', description: 'All kitchen employees', memberCount: 12 },
    { id: '2', name: 'Front of House', description: 'Waiters and hosts', memberCount: 8 },
    { id: '3', name: 'Management', description: 'Managers and supervisors', memberCount: 4 }
  ])

  const [modules] = useState<Module[]>([
    { id: '1', title: 'Food Safety Training', description: 'Basic food safety protocols', type: 'module', duration: 30, status: 'published' },
    { id: '2', title: 'Customer Service Excellence', description: 'Customer service best practices', type: 'module', duration: 45, status: 'published' },
    { id: '3', title: 'Food Safety Assessment', description: 'Test knowledge of food safety', type: 'test', duration: 15, status: 'published' },
    { id: '4', title: 'Hygiene Standards', description: 'Personal hygiene requirements', type: 'module', duration: 20, status: 'draft' }
  ])

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedUsers = users.filter(user => assignmentData.assignedTo.includes(user.id))
  const selectedGroups = groups.filter(group => assignmentData.groupIds.includes(group.id))

  const handleInputChange = (field: keyof AssignmentData, value: any) => {
    setAssignmentData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  const handleUserToggle = (userId: string) => {
    setAssignmentData(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(userId)
        ? prev.assignedTo.filter(id => id !== userId)
        : [...prev.assignedTo, userId]
    }))
  }

  const handleGroupToggle = (groupId: string) => {
    setAssignmentData(prev => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter(id => id !== groupId)
        : [...prev.groupIds, groupId]
    }))
  }

  const removeUser = (userId: string) => {
    setAssignmentData(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.filter(id => id !== userId)
    }))
  }

  const removeGroup = (groupId: string) => {
    setAssignmentData(prev => ({
      ...prev,
      groupIds: prev.groupIds.filter(id => id !== groupId)
    }))
  }

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!assignmentData.moduleId) {
      newErrors.moduleId = 'Please select a module or test'
    }

    if (assignmentData.assignedTo.length === 0 && assignmentData.groupIds.length === 0) {
      newErrors.assignedTo = 'Please select at least one user or group'
    }

    if (!assignmentData.dueDate) {
      newErrors.dueDate = 'Due date is required'
    } else {
      const dueDate = new Date(assignmentData.dueDate)
      const today = new Date()
      if (dueDate <= today) {
        newErrors.dueDate = 'Due date must be in the future'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (validateForm()) {
      if (onSave) {
        onSave(assignmentData)
      }
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getModuleTypeIcon = (type: string) => {
    return type === 'test' ? '📝' : '📚'
  }

  const getModuleTypeColor = (type: string) => {
    return type === 'test' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
  }

  return (
    <div className="space-y-6">
      {/* Module Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Select Module or Test
          </CardTitle>
          <CardDescription>
            Choose what you want to assign to your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {modules.filter(module => module.status === 'published').map((module) => (
              <div
                key={module.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    assignmentData.moduleId === module.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setAssignmentData(prev => ({ ...prev, moduleId: module.id }))
                    setSelectedModule(module)
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl">{getModuleTypeIcon(module.type)}</span>
                      <div>
                        <h4 className="font-medium">{module.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{module.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={getModuleTypeColor(module.type)}>
                            {module.type}
                          </Badge>
                          {module.duration && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {module.duration} min
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <input
                      type="radio"
                      checked={assignmentData.moduleId === module.id}
                      onChange={() => {
                        setAssignmentData(prev => ({ ...prev, moduleId: module.id }))
                        setSelectedModule(module)
                      }}
                      className="w-4 h-4"
                    />
                  </div>
                </div>
            ))}
          </div>
          {errors.moduleId && (
            <p className="text-sm text-red-500 mt-2">{errors.moduleId}</p>
          )}
        </CardContent>
      </Card>

      {/* Assignment Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assignment Details
          </CardTitle>
          <CardDescription>
            Configure who gets the assignment and when it's due
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Recipients */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Assign To</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUserSelection(!showUserSelection)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add People
              </Button>
            </div>

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Individual Users</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <Badge key={user.id} variant="secondary" className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {user.name}
                      <button
                        onClick={() => removeUser(user.id)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Groups */}
            {selectedGroups.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Groups</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedGroups.map((group) => (
                    <Badge key={group.id} variant="secondary" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {group.name} ({group.memberCount})
                      <button
                        onClick={() => removeGroup(group.id)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* User Selection Modal */}
            {showUserSelection && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Select Users and Groups</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowUserSelection(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Users List */}
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                      onClick={() => handleUserToggle(user.id)}
                    >
                      <input
                        type="checkbox"
                        checked={assignmentData.assignedTo.includes(user.id)}
                        onChange={() => handleUserToggle(user.id)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Groups */}
                <div className="mt-4 pt-4 border-t">
                  <h5 className="font-medium text-sm mb-2">Groups</h5>
                  <div className="space-y-2">
                    {groups.map((group) => (
                      <div
                        key={group.id}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                        onClick={() => handleGroupToggle(group.id)}
                      >
                        <input
                          type="checkbox"
                          checked={assignmentData.groupIds.includes(group.id)}
                          onChange={() => handleGroupToggle(group.id)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{group.name}</p>
                          <p className="text-xs text-gray-500">{group.description} ({group.memberCount} members)</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {errors.assignedTo && (
              <p className="text-sm text-red-500">{errors.assignedTo}</p>
            )}
          </div>

          {/* Due Date and Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="datetime-local"
                value={assignmentData.dueDate}
                onChange={(e) => handleInputChange('dueDate', e.target.value)}
                className={errors.dueDate ? 'border-red-500' : ''}
              />
              {errors.dueDate && (
                <p className="text-sm text-red-500 mt-1">{errors.dueDate}</p>
              )}
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={assignmentData.priority}
                onValueChange={(value) => handleInputChange('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Retake Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="allowRetake"
                checked={assignmentData.allowRetake}
                onChange={(e) => handleInputChange('allowRetake', e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="allowRetake">Allow retakes</Label>
            </div>

            {assignmentData.allowRetake && (
              <div>
                <Label htmlFor="maxAttempts">Maximum Attempts</Label>
                <Input
                  id="maxAttempts"
                  type="number"
                  min="1"
                  max="10"
                  value={assignmentData.maxAttempts}
                  onChange={(e) => handleInputChange('maxAttempts', parseInt(e.target.value))}
                />
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              value={assignmentData.message}
              onChange={(e) => handleInputChange('message', e.target.value)}
              placeholder="Add a personal message for the assignment..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {selectedModule && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Assignment Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Module:</span>
                <span className="text-sm">{selectedModule.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Recipients:</span>
                <span className="text-sm">
                  {selectedUsers.length} users, {selectedGroups.length} groups
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Due Date:</span>
                <span className="text-sm">
                  {assignmentData.dueDate ? new Date(assignmentData.dueDate).toLocaleString() : 'Not set'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Priority:</span>
                <Badge className={getPriorityColor(assignmentData.priority)}>
                  {assignmentData.priority}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSave} disabled={!assignmentData.moduleId}>
          <Send className="h-4 w-4 mr-2" />
          Create Assignment
        </Button>
      </div>
    </div>
  )
}
