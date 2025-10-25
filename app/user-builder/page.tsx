"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Users, 
  X, 
  Loader2,
  Save,
  UserPlus
} from "lucide-react"

interface UserConfig {
  name: string
  job: string
  email: string
  password: string
  role: string
}

export default function UserBuilderPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [userConfig, setUserConfig] = useState<UserConfig>({
    name: "",
    job: "",
    email: "",
    password: "",
    role: ""
  })
  
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Check if we're in edit mode
    const editingId = localStorage.getItem('editingUserId')
    if (editingId) {
      setIsEditMode(true)
      setEditingUserId(editingId)
      loadUserForEditing(editingId)
      // Clear the editing ID from localStorage
      localStorage.removeItem('editingUserId')
    }
  }, [session, status, router])

  const loadUserForEditing = (userId: string) => {
    try {
      const savedUsers = JSON.parse(localStorage.getItem('savedUsers') || '[]')
      const userToEdit = savedUsers.find((user: any) => user.id === userId)
      
      if (userToEdit) {
        setUserConfig({
          name: userToEdit.name,
          job: userToEdit.job,
          email: userToEdit.email,
          password: "", // Don't load password for security
          role: userToEdit.role
        })
      }
    } catch (error) {
      console.error('Error loading user for editing:', error)
      setError('Failed to load user for editing')
    }
  }

  const handleInputChange = (field: keyof UserConfig, value: string) => {
    setUserConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const validateForm = () => {
    if (!userConfig.name.trim()) {
      setError("Name is required")
      return false
    }
    if (!userConfig.job.trim()) {
      setError("Job title is required")
      return false
    }
    if (!userConfig.email.trim()) {
      setError("Email is required")
      return false
    }
    if (!userConfig.email.includes('@')) {
      setError("Please enter a valid email address")
      return false
    }
    if (!userConfig.password.trim() && !isEditMode) {
      setError("Password is required")
      return false
    }
    if (userConfig.password.trim() && userConfig.password.length < 6) {
      setError("Password must be at least 6 characters")
      return false
    }
    if (!userConfig.role) {
      setError("Please select a role")
      return false
    }
    return true
  }

  const handleCreateUser = async () => {
    if (!validateForm()) return

    setIsCreating(true)
    setError(null)

    try {
      const existingUsers = JSON.parse(localStorage.getItem('savedUsers') || '[]')

      if (isEditMode && editingUserId) {
        // Update existing user
        const userData = {
          id: editingUserId,
          name: userConfig.name,
          job: userConfig.job,
          email: userConfig.email,
          password: userConfig.password || existingUsers.find((u: any) => u.id === editingUserId)?.password || "",
          role: userConfig.role,
          createdAt: existingUsers.find((u: any) => u.id === editingUserId)?.createdAt || new Date().toISOString(),
          createdBy: session?.user?.name || 'Unknown',
          status: 'active'
        }

        const updatedUsers = existingUsers.map((user: any) => 
          user.id === editingUserId ? userData : user
        )
        localStorage.setItem('savedUsers', JSON.stringify(updatedUsers))

        alert(`User updated successfully!`)
      } else {
        // Create new user
        const userData = {
          id: Date.now().toString(),
          name: userConfig.name,
          job: userConfig.job,
          email: userConfig.email,
          password: userConfig.password,
          role: userConfig.role,
          createdAt: new Date().toISOString(),
          createdBy: session?.user?.name || 'Unknown',
          status: 'active'
        }

        existingUsers.push(userData)
        localStorage.setItem('savedUsers', JSON.stringify(existingUsers))

        alert(`User created successfully!`)
      }
      
      // Redirect to owner users tab
      router.push('/owner?tab=users')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    router.push('/owner?tab=users')
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
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
              <Users className="h-8 w-8 text-blue-600 mr-3 shrink-0" />
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                {isEditMode ? 'Edit User' : 'User Builder'}
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  <CardTitle>User Information</CardTitle>
                  <CardDescription>
                    {isEditMode ? 'Update user details and role' : 'Create a new user account'}
                  </CardDescription>
                </div>
                <Button 
                  onClick={handleCreateUser}
                  disabled={isCreating}
                  className="w-full sm:w-auto"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isEditMode ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      {isEditMode ? 'Update User' : 'Create User'}
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={userConfig.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job">Job Title *</Label>
                    <Input
                      id="job"
                      value={userConfig.job}
                      onChange={(e) => handleInputChange('job', e.target.value)}
                      placeholder="Enter job title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={userConfig.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="Enter email address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">
                      Password {!isEditMode && '*'}
                      {isEditMode && <span className="text-sm text-gray-500 ml-1">(leave blank to keep current)</span>}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={userConfig.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder={isEditMode ? "Enter new password (optional)" : "Enter password"}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="role">Role *</Label>
                    <Select value={userConfig.role} onValueChange={(value) => handleInputChange('role', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select user role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Role Permissions</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    {userConfig.role === 'manager' && (
                      <>
                        <p>• Create and manage tests and assignments</p>
                        <p>• View employee progress and results</p>
                        <p>• Access management dashboard</p>
                        <p>• Import and manage documents</p>
                      </>
                    )}
                    {userConfig.role === 'employee' && (
                      <>
                        <p>• Take assigned tests and training</p>
                        <p>• View personal progress and results</p>
                        <p>• Access employee dashboard</p>
                        <p>• View assigned documents</p>
                      </>
                    )}
                    {!userConfig.role && (
                      <p className="text-gray-600">Select a role to see permissions</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
