"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  GitBranch, 
  Save, 
  Eye, 
  Edit3, 
  Trash2, 
  Plus,
  Clock,
  User,
  CheckCircle,
  AlertCircle,
  Download,
  Upload,
  History,
  Copy
} from "lucide-react"

interface Version {
  id: string
  version: number
  title: string
  description: string
  content: string
  status: 'draft' | 'published' | 'archived'
  changeLog: string
  createdBy: string
  createdAt: string
  publishedAt?: string
  isCurrent: boolean
}

interface VersionManagerProps {
  moduleId: string
  currentVersion?: Version
  onVersionChange?: (version: Version) => void
  onPublish?: (version: Version) => void
  onCreateDraft?: (fromVersion: Version) => void
}

export default function VersionManager({ 
  moduleId, 
  currentVersion,
  onVersionChange,
  onPublish,
  onCreateDraft 
}: VersionManagerProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [draftData, setDraftData] = useState({
    title: '',
    description: '',
    changeLog: ''
  })
  const [showDiff, setShowDiff] = useState(false)

  useEffect(() => {
    // Load versions for the module
    loadVersions()
  }, [moduleId])

  useEffect(() => {
    if (currentVersion) {
      setSelectedVersion(currentVersion)
    }
  }, [currentVersion])

  const loadVersions = () => {
    // Mock data - in production, this would come from API
    const mockVersions: Version[] = [
      {
        id: '1',
        version: 1,
        title: 'Food Safety Training v1.0',
        description: 'Initial version of food safety training module',
        content: 'Initial content...',
        status: 'published',
        changeLog: 'Initial release with basic food safety concepts',
        createdBy: 'John Manager',
        createdAt: '2024-01-01T10:00:00Z',
        publishedAt: '2024-01-01T10:00:00Z',
        isCurrent: true
      },
      {
        id: '2',
        version: 2,
        title: 'Food Safety Training v2.0',
        description: 'Updated version with new regulations',
        content: 'Updated content with new regulations...',
        status: 'draft',
        changeLog: 'Added new FDA regulations and updated procedures',
        createdBy: 'Jane Manager',
        createdAt: '2024-01-15T14:30:00Z',
        isCurrent: false
      },
      {
        id: '3',
        version: 3,
        title: 'Food Safety Training v3.0',
        description: 'Latest version with comprehensive updates',
        content: 'Latest comprehensive content...',
        status: 'draft',
        changeLog: 'Major overhaul with new interactive elements and updated content',
        createdBy: 'Mike Manager',
        createdAt: '2024-01-20T09:15:00Z',
        isCurrent: false
      }
    ]

    setVersions(mockVersions)
  }

  const handleCreateDraft = () => {
    if (!selectedVersion) return

    const newVersion: Version = {
      id: Date.now().toString(),
      version: Math.max(...versions.map(v => v.version)) + 1,
      title: draftData.title || `${selectedVersion.title} v${Math.max(...versions.map(v => v.version)) + 1}`,
      description: draftData.description || selectedVersion.description,
      content: selectedVersion.content,
      status: 'draft',
      changeLog: draftData.changeLog,
      createdBy: 'Current User', // In production, get from session
      createdAt: new Date().toISOString(),
      isCurrent: false
    }

    setVersions(prev => [newVersion, ...prev])
    setSelectedVersion(newVersion)
    setIsCreatingDraft(false)
    setDraftData({ title: '', description: '', changeLog: '' })

    if (onCreateDraft) {
      onCreateDraft(newVersion)
    }
  }

  const handlePublish = (version: Version) => {
    const updatedVersions = versions.map(v => ({
      ...v,
      status: v.id === version.id ? 'published' : 'archived',
      isCurrent: v.id === version.id,
      publishedAt: v.id === version.id ? new Date().toISOString() : v.publishedAt
    }))

    setVersions(updatedVersions)
    setSelectedVersion({ ...version, status: 'published', isCurrent: true })

    if (onPublish) {
      onPublish({ ...version, status: 'published', isCurrent: true })
    }
  }

  const handleVersionSelect = (version: Version) => {
    setSelectedVersion(version)
    if (onVersionChange) {
      onVersionChange(version)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'draft': return <Edit3 className="h-4 w-4 text-yellow-500" />
      case 'archived': return <History className="h-4 w-4 text-gray-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderDiff = (version1: Version, version2: Version) => {
    // Simple diff implementation - in production, use a proper diff library
    const lines1 = version1.content.split('\n')
    const lines2 = version2.content.split('\n')
    
    return (
      <div className="space-y-2">
        <div className="text-sm text-gray-600 mb-4">
          Comparing {version1.title} with {version2.title}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-sm mb-2 text-red-600">Removed (v{version1.version})</h4>
            <div className="bg-red-50 p-3 rounded text-sm max-h-40 overflow-y-auto">
              {lines1.filter(line => !lines2.includes(line)).map((line, index) => (
                <div key={index} className="text-red-700">- {line}</div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-2 text-green-600">Added (v{version2.version})</h4>
            <div className="bg-green-50 p-3 rounded text-sm max-h-40 overflow-y-auto">
              {lines2.filter(line => !lines1.includes(line)).map((line, index) => (
                <div key={index} className="text-green-700">+ {line}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Version List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Version History
              </CardTitle>
              <CardDescription>
                Manage different versions of your content
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiff(!showDiff)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {showDiff ? 'Hide' : 'Show'} Diff
              </Button>
              <Button
                size="sm"
                onClick={() => setIsCreatingDraft(true)}
                disabled={!selectedVersion}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Draft
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {versions.map((version) => (
              <div
                key={version.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedVersion?.id === version.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleVersionSelect(version)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{version.title}</h4>
                      <Badge className={getStatusColor(version.status)}>
                        {getStatusIcon(version.status)}
                        <span className="ml-1 capitalize">{version.status}</span>
                      </Badge>
                      {version.isCurrent && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          Current
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">{version.description}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {version.createdBy}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(version.createdAt)}
                      </span>
                      {version.publishedAt && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Published {formatDate(version.publishedAt)}
                        </span>
                      )}
                    </div>

                    {version.changeLog && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <strong>Changes:</strong> {version.changeLog}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {version.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePublish(version)
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Publish
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        // Handle copy version
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Draft Modal */}
      {isCreatingDraft && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Draft</CardTitle>
            <CardDescription>
              Create a new draft version based on the selected version
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="draftTitle">Title</Label>
              <Input
                id="draftTitle"
                value={draftData.title}
                onChange={(e) => setDraftData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter draft title..."
              />
            </div>

            <div>
              <Label htmlFor="draftDescription">Description</Label>
              <Input
                id="draftDescription"
                value={draftData.description}
                onChange={(e) => setDraftData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter draft description..."
              />
            </div>

            <div>
              <Label htmlFor="changeLog">Change Log</Label>
              <Textarea
                id="changeLog"
                value={draftData.changeLog}
                onChange={(e) => setDraftData(prev => ({ ...prev, changeLog: e.target.value }))}
                placeholder="Describe what changes you're making..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreatingDraft(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateDraft}>
                <Save className="h-4 w-4 mr-2" />
                Create Draft
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diff View */}
      {showDiff && selectedVersion && versions.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Version Comparison</CardTitle>
            <CardDescription>
              Compare changes between versions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderDiff(versions[1], selectedVersion)}
          </CardContent>
        </Card>
      )}

      {/* Current Version Details */}
      {selectedVersion && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Version Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{selectedVersion.title}</h4>
                <p className="text-sm text-gray-600 mb-3">{selectedVersion.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Version:</span> {selectedVersion.version}
                </div>
                <div>
                  <span className="font-medium">Status:</span> 
                  <Badge className={`ml-2 ${getStatusColor(selectedVersion.status)}`}>
                    {selectedVersion.status}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Created by:</span> {selectedVersion.createdBy}
                </div>
                <div>
                  <span className="font-medium">Created:</span> {formatDate(selectedVersion.createdAt)}
                </div>
              </div>

              {selectedVersion.changeLog && (
                <div className="mt-4 p-3 bg-gray-50 rounded">
                  <h5 className="font-medium text-sm mb-1">Change Log:</h5>
                  <p className="text-sm text-gray-600">{selectedVersion.changeLog}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                {selectedVersion.status === 'draft' && (
                  <Button size="sm">
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
