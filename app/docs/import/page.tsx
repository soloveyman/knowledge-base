"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { PageLayout } from "@/components/common/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ErrorMessage } from "@/components/common/error-message"
import { Progress } from "@/components/ui/progress"
import { 
  FileText, 
  X, 
  CheckCircle, 
  Loader2,
  AlertCircle
} from "lucide-react"
import { parseDocument, ParsedContent } from '@/lib/parsers'
import { clearParsingCache } from '@/lib/localStorage-utils'
import { useTranslation } from '@/lib/translation-context'

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  status: 'uploading' | 'processing' | 'ready' | 'error'
  progress: number
  error?: string
  parsedContent?: ParsedContent
  parsingLog?: Array<{
    level?: string
    message?: string
    timestamp?: string
    [key: string]: unknown
  }>
  file?: File // Store the actual File object
}

const ACCEPTED_FILE_TYPES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
}

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB

function DocImportPageInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get the return URL from query parameters, with proper encoding
  const returnTo = searchParams.get('returnTo') || '/docs'
  
  // Validate returnTo URL to prevent open redirects
  const isValidReturnUrl = (url: string) => {
    try {
      const parsed = new URL(url, window.location.origin)
      return parsed.origin === window.location.origin
    } catch {
      return false
    }
  }
  
  const safeReturnTo = isValidReturnUrl(returnTo) ? returnTo : '/docs'

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }
  }, [session, status, router])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files))
    }
  }

  const handleFiles = (fileList: File[]) => {
    setError(null)
    const newFiles: UploadedFile[] = []

    fileList.forEach((file) => {
      // Validate file type
      if (!Object.keys(ACCEPTED_FILE_TYPES).includes(file.type)) {
        setError(`File type ${file.type} is not supported`)
        return
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(`File ${file.name} is too large. Maximum size is 15MB`)
        return
      }

      const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
      newFiles.push({
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading',
        progress: 0,
        file: file // Store the actual File object
      })
    })

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles])
      uploadFiles(newFiles)
    }
  }

  const uploadFiles = async (filesToUpload: UploadedFile[]) => {
    setIsUploading(true)
    
    for (const file of filesToUpload) {
      try {
        // Set status to processing immediately
        setFiles(prev => prev.map(f => 
          f.id === file.id 
            ? { ...f, status: 'processing', progress: 0 }
            : f
        ))

        // Parse the file content - use the file from filesToUpload since files state might not be updated yet
        const fileObj = filesToUpload.find(f => f.id === file.id)
        console.log('Looking for file with id:', file.id, 'Found:', !!fileObj, 'Has file:', !!(fileObj && fileObj.file))
        if (fileObj && fileObj.file) {
          try {
            // Clear any cached parsing results to ensure fresh parsing
            clearParsingCache()
            
            console.log(`Starting to parse file: ${fileObj.name}`)
            const startTime = Date.now()
            
            const parsedContent = await parseDocument(fileObj.file)
            
            const endTime = Date.now()
            console.log(`Parsing completed in ${endTime - startTime}ms for file: ${fileObj.name}`)
            
            setFiles(prev => prev.map(f => 
              f.id === file.id 
                ? { 
                    ...f, 
                    status: 'ready',
                    progress: 100,
                    parsedContent: parsedContent,
                    parsingLog: []
                  }
                : f
            ))
          } catch (parseError) {
            console.error('Parse error:', parseError)
            setFiles(prev => prev.map(f => 
              f.id === file.id 
                ? { 
                    ...f, 
                    status: 'error', 
                    error: parseError instanceof Error ? parseError.message : 'Parse failed'
                  }
                : f
            ))
          }
        } else {
          console.error('File object not found for id:', file.id)
          setFiles(prev => prev.map(f => 
            f.id === file.id 
              ? { ...f, status: 'error', error: 'File object not found' }
              : f
          ))
        }
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === file.id 
            ? { ...f, status: 'error', error: 'Upload failed' }
            : f
        ))
      }
    }
    
    setIsUploading(false)
  }

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const saveDocuments = async () => {
    const readyFiles = files.filter(f => f.status === 'ready')
    if (readyFiles.length === 0) return

    setIsUploading(true)
    
    try {
      // Save all files in parallel and wait for all to complete
      const savePromises = readyFiles.map(async (file) => {
        console.log('Saving document:', file.name)
        console.log('ParsedContent exists:', !!file.parsedContent)
        console.log('ParsedContent sections:', file.parsedContent?.sections?.length || 0)
        console.log('ParsedContent tables:', file.parsedContent?.tables?.length || 0)
        
        const response = await fetch('/api/documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: file.name,
            originalFileName: file.name,
            fileType: file.type.split('/')[1],
            fileUrl: null, // UploadedFile doesn't have url property - file is stored via upload
            fileSize: file.size,
            parsedContent: file.parsedContent || null,
            parsingLog: file.parsingLog || null,
            uploadedBy: session?.user?.id || 'unknown'
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('Failed to save document:', file.name, errorData)
          throw new Error(`Failed to save ${file.name}`)
        } else {
          const result = await response.json()
          console.log('Document saved successfully:', file.name, result)
          return result
        }
      })

      // Wait for all saves to complete
      await Promise.all(savePromises)
      
      console.log('All documents saved successfully, redirecting...')
      
      // Add a small delay to ensure database transaction is committed
      // This prevents race condition where redirect happens before DB commit
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Redirect to the specified return URL with cache-busting
      // Add a timestamp to force fresh data load
      const redirectUrl = safeReturnTo.includes('?') 
        ? `${safeReturnTo}&_t=${Date.now()}`
        : `${safeReturnTo}?_t=${Date.now()}`
      
      router.push(redirectUrl)
    } catch (error) {
      console.error('Error saving documents:', error)
      setError('Failed to save some documents. Please try again.')
      setIsUploading(false)
    }
  }

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
      default:
        return null
    }
  }

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...'
      case 'processing':
        return 'Processing...'
      case 'ready':
        return 'Ready'
      case 'error':
        return 'Error'
      default:
        return ''
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
    <PageLayout
      title={t('importDocuments')}
      icon={<FileText className="h-6 w-6" />}
      onClose={() => router.push(safeReturnTo)}
    >
      <div className="max-w-4xl mx-auto space-y-3 md:space-y-6">
        {/* Upload Area */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('uploadDocuments')}</CardTitle>
              <CardDescription>
                {t('uploadWordExcelFiles')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`relative border-2 border-dashed rounded-3xl p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/10 text-primary-700 dark:text-primary-300' 
                  : 'border-border hover:border-accent'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <span className="text-5xl block mb-4">📤</span>
              <div className="space-y-2">
                <p className="text-lg font-medium text-foreground">
                  {t('dropFilesHere')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('supportsDocxXlsx')}
                </p>
              </div>
              <Input
                type="file"
                multiple
                accept={Object.keys(ACCEPTED_FILE_TYPES).join(',')}
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        <ErrorMessage error={error} showIcon={true} />

        {/* File List */}
        {files.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Uploaded Files</CardTitle>
              <CardDescription>
                {files.filter(f => f.status === 'ready').length} of {files.length} files ready
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-4 border rounded-3xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                      {file.status === 'uploading' && (
                        <Progress value={file.progress} className="mt-2 h-2" />
                      )}
                      {file.error && (
                        <p className="text-sm text-destructive mt-1">{file.error}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(file.status)}
                      <span className="text-sm text-muted-foreground">
                        {getStatusText(file.status)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {files.some(f => f.status === 'ready') && (
                <div className="mt-6 flex justify-end">
                  <Button 
                    onClick={saveDocuments}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Save Documents
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  )
}

export default function DocImportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div></div>}>
      <DocImportPageInner />
    </Suspense>
  )
}
