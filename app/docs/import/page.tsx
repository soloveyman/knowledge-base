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
import { useGooglePicker } from '@/lib/hooks/use-google-picker'
import type { GooglePickerDocument } from '@/types/google-picker'
import { toast } from 'sonner'

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  status: 'uploading' | 'processing' | 'ready' | 'error'
  progress: number
  error?: string
  warning?: string // Warning message about large images
  parsedContent?: ParsedContent
  parsingLog?: Array<{
    level?: string
    message?: string
    timestamp?: string
    [key: string]: unknown
  }>
  file?: File // Store the actual File object
  fileUrl?: string | null // URL for Google Drive files
}

const ACCEPTED_FILE_TYPES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB (images are stored separately in Spaces, only text content is counted)

/**
 * Extract file extension from filename or MIME type
 * Returns 'docx', 'xlsx', or 'pdf' to match the schema enum
 */
function getFileType(fileName: string, mimeType?: string): 'docx' | 'xlsx' | 'pdf' | null {
  // First, try to extract from filename (most reliable, especially for Cyrillic names)
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (extension === 'docx' || extension === 'xlsx' || extension === 'pdf') {
    return extension
  }
  
  // Fallback to MIME type mapping
  if (mimeType) {
    const mappedExt = ACCEPTED_FILE_TYPES[mimeType as keyof typeof ACCEPTED_FILE_TYPES]
    if (mappedExt === '.docx') return 'docx'
    if (mappedExt === '.xlsx') return 'xlsx'
    if (mimeType === 'application/pdf') return 'pdf'
  }
  
  return null
}

function DocImportPageInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [isGooglePickerLoading, setIsGooglePickerLoading] = useState(false)
  
  const { openPicker, isLoading: isPickerInitializing } = useGooglePicker()

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
    console.log('[handleFiles] Processing files:', fileList.length)
    const newFiles: UploadedFile[] = []

    fileList.forEach((file) => {
      console.log('[handleFiles] Processing file:', {
        name: file.name,
        type: file.type,
        size: file.size
      })

      // Validate file type
      if (!Object.keys(ACCEPTED_FILE_TYPES).includes(file.type)) {
        console.warn('[handleFiles] Unsupported file type:', file.type)
        toast.error(t('fileTypeNotSupported').replace('{type}', file.type), {
          description: 'Please upload DOCX or XLSX files only',
          duration: 5000
        })
        return
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        console.warn('[handleFiles] File too large:', file.size, 'max:', MAX_FILE_SIZE)
        toast.error(t('fileTooLarge').replace('{name}', file.name), {
          description: `Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`,
          duration: 5000
        })
        return
      }

      const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
      const newFile: UploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading',
        progress: 0,
        file: file // Store the actual File object
      }
      
      console.log('[handleFiles] Created file entry:', {
        id: newFile.id,
        name: newFile.name,
        hasFile: !!newFile.file
      })
      
      newFiles.push(newFile)
    })

    if (newFiles.length > 0) {
      console.log('[handleFiles] Adding files to state and starting upload:', newFiles.length)
      setFiles(prev => {
        const updated = [...prev, ...newFiles]
        console.log('[handleFiles] Total files in state:', updated.length)
        return updated
      })
      uploadFiles(newFiles)
    } else {
      console.warn('[handleFiles] No valid files to process')
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
        console.log('File details:', {
          name: fileObj?.name,
          source: fileObj?.name?.includes('Google') ? 'Google Drive' : 'Local upload',
          hasFileObject: !!(fileObj && fileObj.file),
          fileType: fileObj?.file?.type,
          fileSize: fileObj?.file?.size
        })
        if (fileObj && fileObj.file) {
          try {
            // Clear any cached parsing results to ensure fresh parsing
            clearParsingCache()
            
            console.log(`Starting to parse file: ${fileObj.name}`)
            console.log(`File source: ${fileObj.name.includes('Google') ? 'Google Drive' : 'Local upload'}`)
            const startTime = Date.now()
            
            const parsedContent = await parseDocument(fileObj.file)
            
            const endTime = Date.now()
            console.log(`Parsing completed in ${endTime - startTime}ms for file: ${fileObj.name}`)
            console.log(`Parsed content summary:`, {
              sections: parsedContent.sections?.length || 0,
              tables: parsedContent.tables?.length || 0,
              images: parsedContent.images?.length || 0,
              hasMetadata: !!parsedContent.metadata
            })
            
            // Images are uploaded to Spaces, size warnings are not needed
            setFiles(prev => prev.map(f => {
              if (f.id === file.id) {
                const updatedFile: UploadedFile = {
                  ...f,
                  status: 'ready' as const,
                  progress: 100,
                  parsedContent: parsedContent,
                  parsingLog: [],
                  warning: undefined
                }
                console.log(`File ${fileObj.name} marked as ready:`, {
                  hasParsedContent: !!updatedFile.parsedContent,
                  sections: updatedFile.parsedContent?.sections?.length || 0,
                  tables: updatedFile.parsedContent?.tables?.length || 0,
                  images: updatedFile.parsedContent?.images?.length || 0
                })
                return updatedFile
              }
              return f
            }))
            
            // No warnings needed - images are uploaded to Spaces
            console.log(`✅ File ${fileObj?.name} is ready to save (no warnings)`)
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

  // Обработка файла из Google Drive
  const handleGoogleDriveFile = async (file: GooglePickerDocument, accessToken: string) => {
    setIsGooglePickerLoading(true)

    try {
      console.log('[Google Drive] Processing file:', {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.sizeBytes
      })

      // Проверить тип файла
      const isDocx = file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const isXlsx = file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      
      if (!isDocx && !isXlsx) {
        throw new Error('Only DOCX and XLSX files are supported')
      }

      console.log('[Google Drive] Downloading file from Drive API...')
      
      // Скачать файл через Drive API
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: { message: errorText } }
        }
        console.error('[Google Drive] Download failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })
        throw new Error(errorData.error?.message || `Failed to download file from Google Drive (${response.status})`)
      }

      const blob = await response.blob()
      console.log('[Google Drive] File downloaded:', {
        size: blob.size,
        type: blob.type
      })
      
      // Проверить размер файла
      if (blob.size > MAX_FILE_SIZE) {
        throw new Error(`File size (${formatFileSize(blob.size)}) exceeds maximum allowed size (${formatFileSize(MAX_FILE_SIZE)})`)
      }

      // Преобразовать blob в File
      // Важно: сохраняем оригинальное имя файла из Google Drive для правильной идентификации
      const fileObj = new File([blob], file.name, {
        type: file.mimeType,
        lastModified: Date.now()
      })

      console.log('[Google Drive] File object created:', {
        name: fileObj.name,
        size: fileObj.size,
        type: fileObj.type,
        lastModified: fileObj.lastModified,
        hasBlob: !!blob,
        blobSize: blob.size
      })

      // Использовать существующую логику обработки файла
      console.log('[Google Drive] Calling handleFiles with file object')
      console.log('[Google Drive] File object details:', {
        name: fileObj.name,
        size: fileObj.size,
        type: fileObj.type,
        lastModified: fileObj.lastModified,
        isFile: fileObj instanceof File,
        constructor: fileObj.constructor.name,
        googleDriveUrl: file.url
      })
      
      // Убедимся, что File объект валиден перед передачей
      if (!(fileObj instanceof File)) {
        throw new Error('Failed to create valid File object from Google Drive blob')
      }
      
      if (!fileObj.name || fileObj.size === 0) {
        throw new Error(`Invalid file object: name=${fileObj.name}, size=${fileObj.size}`)
      }
      
      // Добавить файл вручную с сохранением Google Drive URL
      const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
      const googleDriveFile: UploadedFile = {
        id: fileId,
        name: fileObj.name,
        size: fileObj.size,
        type: fileObj.type,
        status: 'uploading',
        progress: 0,
        file: fileObj,
        fileUrl: file.url // Сохранить URL из Google Drive
      }
      
      console.log('[Google Drive] Created file entry with URL:', {
        id: googleDriveFile.id,
        name: googleDriveFile.name,
        fileUrl: googleDriveFile.fileUrl,
        hasFile: !!googleDriveFile.file
      })
      
      setFiles(prev => {
        const updated = [...prev, googleDriveFile]
        console.log('[Google Drive] Total files in state:', updated.length)
        return updated
      })
      
      uploadFiles([googleDriveFile])
      
      console.log('[Google Drive] File added to processing queue')
      
      toast.success(t('fileImportedFromGoogleDrive'), {
        description: `${file.name} is being processed. Please wait for processing to complete, then click "Save Documents".`,
        duration: 5000
      })
    } catch (error) {
      console.error('[Google Drive] Error handling Google Drive file:', error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to import from Google Drive'
      
      // More specific error messages
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        toast.error(t('authorizationFailed'), {
          description: 'Please try selecting the file again. Your access token may have expired.',
          duration: 6000
        })
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        toast.error(t('accessDenied'), {
          description: 'You may not have permission to access this file. Make sure you are signed in with the correct Google account.',
          duration: 6000
        })
      } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        toast.error(t('fileNotFound'), {
          description: 'The file may have been deleted or moved. Please try selecting it again.',
          duration: 6000
        })
      } else {
        toast.error(errorMessage, {
          duration: 5000
        })
      }
    } finally {
      setIsGooglePickerLoading(false)
    }
  }

  // Открыть Google Picker
  const handleOpenGooglePicker = async () => {
    setIsGooglePickerLoading(true)

    try {
      await openPicker((file, accessToken) => {
        handleGoogleDriveFile(file, accessToken)
      })
    } catch (error) {
      console.error('Google Picker error:', error)
      
      // Извлечь сообщение об ошибке из разных типов
      let errorMessage = 'Failed to open Google Drive'
      
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        // Попробовать извлечь сообщение из объекта
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message
        } else if ('error' in error && typeof error.error === 'string') {
          errorMessage = error.error
        } else if ('toString' in error) {
          const errorString = error.toString()
          if (errorString !== '[object Object]') {
            errorMessage = errorString
          }
        }
      }
      
      // Показать toast для ошибок конфигурации
      if (errorMessage.includes('GOOGLE_CLIENT_ID') || 
          errorMessage.includes('not configured') || 
          errorMessage.includes('environment variables') ||
          errorMessage.includes('Google OAuth not configured')) {
        toast.error(t('googleDriveNotConfigured'), {
          description: 'Проверьте настройки GOOGLE_CLIENT_ID в .env.local',
          duration: 6000
        })
      } else if (errorMessage.includes('idpiframe_initialization_failed') ||
                 errorMessage.includes('OAuth initialization failed')) {
        toast.error(t('oauthInitializationError'), {
          description: 'Убедитесь, что ваш Google аккаунт добавлен как тестовый пользователь в OAuth Consent Screen в Google Cloud Console',
          duration: 8000
        })
      } else if (errorMessage.includes('access_denied') || 
                 errorMessage.includes('Access blocked') ||
                 errorMessage.includes('не прошло проверку')) {
        toast.error(t('accessBlocked'), {
          description: 'Приложение в режиме тестирования. Добавьте ваш email в Test users в Google Cloud Console или опубликуйте приложение. См. GOOGLE_OAUTH_TESTING_MODE_FIX.md',
          duration: 10000
        })
      } else if (errorMessage.includes('not loaded') || 
                 errorMessage.includes('API is not loaded') ||
                 errorMessage.includes('Failed to load')) {
        toast.error(t('failedToLoadGooglePicker'), {
          description: 'Проверьте подключение к интернету и попробуйте снова',
          duration: 6000
        })
      } else if (errorMessage.includes('Authorization cancelled')) {
        // Не показывать ошибку, если пользователь отменил авторизацию
        // Состояние загрузки будет сброшено в finally
      } else {
        toast.error(errorMessage, {
          duration: 5000
        })
      }
    } finally {
      // Всегда сбрасываем состояние загрузки, даже если пикер был закрыт без выбора файла
      setIsGooglePickerLoading(false)
    }
  }

  const saveDocuments = async () => {
    console.log('saveDocuments called, total files:', files.length)
    console.log('Files status breakdown:', {
      ready: files.filter(f => f.status === 'ready').length,
      processing: files.filter(f => f.status === 'processing').length,
      uploading: files.filter(f => f.status === 'uploading').length,
      error: files.filter(f => f.status === 'error').length
    })
    
    const readyFiles = files.filter(f => f.status === 'ready')
    console.log('Ready files:', readyFiles.length, readyFiles.map(f => ({ name: f.name, hasParsedContent: !!f.parsedContent })))
    
    if (readyFiles.length === 0) {
      console.warn('No ready files to save')
      toast.error(t('noFilesReadyToSave'), {
        description: 'Please wait for files to finish processing',
        duration: 5000
      })
      return
    }

    setIsUploading(true)
    
    try {
      // Save all files in parallel and wait for all to complete
      const savePromises = readyFiles.map(async (file) => {
        console.log('Saving document:', file.name)
        console.log('File source:', file.name.includes('Google') ? 'Google Drive' : 'Local upload')
        console.log('File status:', file.status)
        console.log('ParsedContent exists:', !!file.parsedContent)
        console.log('ParsedContent sections:', file.parsedContent?.sections?.length || 0)
        console.log('ParsedContent tables:', file.parsedContent?.tables?.length || 0)
        console.log('ParsedContent images:', file.parsedContent?.images?.length || 0)
        if (file.parsedContent?.images && file.parsedContent.images.length > 0) {
          console.log('Image positions:', file.parsedContent.images.map((img) => ({ filename: img.filename, position: img.position })))
        }
        
        try {
          // Validate that parsedContent exists before saving
          if (!file.parsedContent) {
            console.error(`[Save Error] File ${file.name} has no parsedContent - cannot save`)
            throw new Error(`File "${file.name}" is not ready to save. Please wait for processing to complete.`)
          }
          
          // Validate parsedContent structure
          if (!file.parsedContent.sections || !Array.isArray(file.parsedContent.sections)) {
            console.error(`[Save Error] File ${file.name} has invalid parsedContent.sections`)
            throw new Error(`File "${file.name}" has invalid content structure. Please re-upload the file.`)
          }
          
          // Log that we're attempting to save (even if there are warnings)
          const hasWarning = !!file.warning
          console.log(`[Save] Attempting to save file: ${file.name}`, {
            source: file.name.includes('Google') ? 'Google Drive' : 'Local upload',
            hasWarning,
            warning: hasWarning ? file.warning : 'none',
            hasParsedContent: !!file.parsedContent,
            sections: file.parsedContent?.sections?.length || 0,
            images: file.parsedContent?.images?.length || 0
          })
          
          // Check payload size - if with images it exceeds limit, send without images first
          const VERCEL_LIMIT_MB = 4.5
          
          // Transform parsingLog to ensure required fields
          const transformParsingLog = (log: UploadedFile['parsingLog']): Array<{
            level: string
            message: string
            timestamp?: string
          }> | null => {
            if (!log || !Array.isArray(log)) return null
            return log
              .filter((entry): entry is { level: string; message: string; timestamp?: string } => 
                typeof entry?.level === 'string' && typeof entry?.message === 'string'
              )
              .map(entry => ({
                level: entry.level,
                message: entry.message,
                timestamp: entry.timestamp
              }))
          }
          
          // Calculate size without images
          const extractedFileType = getFileType(file.name, file.type)
          if (!extractedFileType) {
            throw new Error(`Unsupported file type for "${file.name}". Only DOCX, XLSX, and PDF files are supported.`)
          }
          
          const requestBodyWithoutImages = {
            title: file.name,
            originalFileName: file.name,
            fileType: extractedFileType,
            fileUrl: file.fileUrl || null,
            fileSize: file.size,
            parsedContent: {
              ...file.parsedContent,
              images: [] // Exclude images for size check
            },
            parsingLog: transformParsingLog(file.parsingLog),
            uploadedBy: session?.user?.id || 'unknown'
          }
          const sizeWithoutImages = JSON.stringify(requestBodyWithoutImages).length / (1024 * 1024)
          
          // Calculate size with images
          const requestBodyWithImages = {
            ...requestBodyWithoutImages,
            parsedContent: {
              ...file.parsedContent
            }
          }
          const sizeWithImages = JSON.stringify(requestBodyWithImages).length / (1024 * 1024)
          
          console.log(`Payload size check for ${file.name}:`, {
            textOnly: `${sizeWithoutImages.toFixed(2)}MB`,
            withImages: `${sizeWithImages.toFixed(2)}MB`,
            fileSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
            imagesCount: file.parsedContent?.images?.length || 0
          })
          
          // If text content exceeds limit, send document with minimal parsedContent first
          // Then update parsedContent separately
          const sendMinimalContent = sizeWithoutImages > VERCEL_LIMIT_MB
          
          if (sendMinimalContent) {
            console.log(`⚠️ Document text content (${sizeWithoutImages.toFixed(2)}MB) exceeds Vercel limit. Will send minimal content first, then update separately.`)
          }
          
          // If payload with images exceeds limit, send without images first
          // Images will be uploaded separately after document is created
          const sendImagesInPayload = sizeWithImages <= VERCEL_LIMIT_MB
          
          if (!sendImagesInPayload) {
            console.log(`⚠️ Payload with images (${sizeWithImages.toFixed(2)}MB) exceeds Vercel limit. Will send document without images and upload them separately.`)
          }
          
          // Prepare request body
          interface DocumentRequestBody {
            title: string
            originalFileName: string
            fileType: string
            fileUrl: string | null
            fileSize: number
            parsedContent: ParsedContent | { sections: []; tables: []; images: []; metadata: ParsedContent['metadata'] }
            parsingLog: Array<{
              level: string
              message: string
              timestamp?: string
            }> | null
            uploadedBy: string
          }
          
          let requestBody: DocumentRequestBody
          
          if (sendMinimalContent) {
            // Send document with minimal parsedContent (only metadata)
            requestBody = {
              title: file.name,
              originalFileName: file.name,
              fileType: extractedFileType,
              fileUrl: file.fileUrl || null,
              fileSize: file.size,
              parsedContent: {
                sections: [],
                tables: [],
                images: [],
                metadata: file.parsedContent?.metadata || {}
              },
              parsingLog: transformParsingLog(file.parsingLog),
              uploadedBy: session?.user?.id || 'unknown'
            }
          } else {
            // Send with full content (with or without images based on size)
            requestBody = sendImagesInPayload 
              ? requestBodyWithImages
              : requestBodyWithoutImages
          }
          
          const payloadString = JSON.stringify(requestBody)
          
          const response = await fetch('/api/documents', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: payloadString,
          })

          if (!response.ok) {
            let errorData
            try {
              errorData = await response.json()
            } catch {
              errorData = { message: response.statusText }
            }
            console.error('Failed to save document:', file.name, {
              status: response.status,
              statusText: response.statusText,
              errorData
            })
            throw new Error(`Failed to save ${file.name}: ${errorData.message || response.statusText}`)
          }
          
          let result
          try {
            result = await response.json()
          } catch (parseError) {
            console.error('Failed to parse response JSON:', parseError)
            throw new Error(`Failed to parse server response for ${file.name}`)
          }

          if (!result.success) {
            console.error('Document save returned success=false:', file.name, result)
            throw new Error(`Failed to save ${file.name}: ${result.message || 'Unknown error'}`)
          }
          
          if (!result.data || !result.data.document) {
            console.error('[Save Error] Document save response missing document data:', file.name, result)
            throw new Error(`Server response missing document data for ${file.name}`)
          }
          
          const documentId = result.data.document.id
          
          // If document was sent with minimal content, update parsedContent separately
          // Split into parts if needed to avoid size limits
          if (sendMinimalContent) {
            console.log(`📤 Updating parsedContent separately for document ${documentId}...`)
            
            try {
              // Get existing document to merge with
              const getDocResponse = await fetch(`/api/documents/${documentId}`)
              const getDocResult = await getDocResponse.json()
              const existingParsedContent = getDocResult.data?.document?.parsedContent || { sections: [], tables: [], images: [], metadata: {} }
              
              // Prepare parsedContent for update (NEVER include base64 image data in metadata)
              const fullParsedContent = {
                ...file.parsedContent,
                images: file.parsedContent?.images?.map((img) => {
                  // Omit data property - images will be uploaded separately
                  const { data, ...imageWithoutData } = img
                  return {
                    filename: imageWithoutData.filename,
                    type: imageWithoutData.type,
                    position: imageWithoutData.position
                  }
                }) || []
              }
              
              // Merge with existing content
              const mergedContent = {
                ...fullParsedContent,
                sections: fullParsedContent.sections || existingParsedContent.sections || [],
                tables: fullParsedContent.tables || existingParsedContent.tables || [],
                images: fullParsedContent.images || existingParsedContent.images || [],
                metadata: {
                  ...existingParsedContent.metadata,
                  ...fullParsedContent.metadata
                }
              }
              
              // Check size and split into parts if needed
              const updatePayloadSize = JSON.stringify({ parsedContent: mergedContent }).length / (1024 * 1024)
              
              if (updatePayloadSize > VERCEL_LIMIT_MB) {
                console.log(`⚠️ parsedContent (${updatePayloadSize.toFixed(2)}MB) exceeds limit. Splitting into parts...`)
                
                // Split sections into chunks with size checking
                const sections = mergedContent.sections || []
                const tables = mergedContent.tables || []
                const images = mergedContent.images || []
                const metadata = mergedContent.metadata || {}
                
                // Get current document content to merge incrementally
                let currentContent: ParsedContent = {
                  sections: [],
                  tables: [],
                  images: [],
                  metadata: {
                    totalSections: 0,
                    totalTables: 0,
                    wordCount: 0,
                    totalImages: 0,
                    ...metadata
                  }
                }
                
                // Update with metadata first (small)
                const metadataPayload = JSON.stringify({ parsedContent: currentContent }).length / (1024 * 1024)
                if (metadataPayload < VERCEL_LIMIT_MB) {
                  const metadataResponse = await fetch(`/api/documents/${documentId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parsedContent: currentContent })
                  })
                  if (metadataResponse.ok) {
                    console.log(`✅ Updated metadata for document ${documentId}`)
                  }
                }
                
                // Update sections incrementally - add one by one until we hit size limit
                let accumulatedSections: ParsedContent['sections'] = []
                for (let i = 0; i < sections.length; i++) {
                  const section = sections[i]
                  
                  // Check if single section is too large - if so, truncate content
                  let sectionToAdd = section
                  const singleSectionTest = {
                    ...currentContent,
                    sections: [...accumulatedSections, section]
                  }
                  const singleSectionSize = JSON.stringify({ parsedContent: singleSectionTest }).length / (1024 * 1024)
                  
                  if (singleSectionSize > VERCEL_LIMIT_MB * 0.9) {
                    // Single section is too large - truncate its content
                    const maxContentLength = 100000 // ~100KB per section to be safe
                    if (section.content && section.content.length > maxContentLength) {
                      console.warn(`⚠️ Section "${section.title || 'untitled'}" content too large (${(section.content.length / 1024).toFixed(2)}KB), truncating to ${(maxContentLength / 1024).toFixed(2)}KB`)
                      sectionToAdd = {
                        ...section,
                        content: section.content.substring(0, maxContentLength) + '\n\n[... content truncated due to size limit ...]'
                      }
                    }
                  }
                  
                  const testContent = {
                    ...currentContent,
                    sections: [...accumulatedSections, sectionToAdd]
                  }
                  const testSize = JSON.stringify({ parsedContent: testContent }).length / (1024 * 1024)
                  
                  if (testSize > VERCEL_LIMIT_MB * 0.9 && accumulatedSections.length > 0) {
                    // Current batch is too large, send what we have
                    currentContent.sections = accumulatedSections
                    const batchResponse = await fetch(`/api/documents/${documentId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ parsedContent: currentContent })
                    })
                    if (batchResponse.ok) {
                      console.log(`✅ Updated sections batch (${accumulatedSections.length} sections) for document ${documentId}`)
                      // Get updated content for next batch
                      const getResponse = await fetch(`/api/documents/${documentId}`)
                      const getResult = await getResponse.json()
                      currentContent = getResult.data?.document?.parsedContent || currentContent
                      accumulatedSections = [sectionToAdd] // Start new batch with current section
                    } else {
                      console.warn(`⚠️ Failed to update sections batch, trying with smaller batch...`)
                      // Try with just current section if batch failed
                      if (accumulatedSections.length > 1) {
                        accumulatedSections = [sectionToAdd]
                      } else {
                        // Even single section failed - skip it
                        console.warn(`⚠️ Skipping section "${section.title || 'untitled'}" - too large even alone`)
                        accumulatedSections = []
                      }
                    }
                  } else {
                    accumulatedSections.push(sectionToAdd)
                  }
                }
                
                // Send remaining sections
                if (accumulatedSections.length > 0) {
                  currentContent.sections = [...(currentContent.sections || []), ...accumulatedSections]
                  const finalSectionsResponse = await fetch(`/api/documents/${documentId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parsedContent: currentContent })
                  })
                  if (finalSectionsResponse.ok) {
                    console.log(`✅ Updated final sections batch (${accumulatedSections.length} sections) for document ${documentId}`)
                    const getResponse = await fetch(`/api/documents/${documentId}`)
                    const getResult = await getResponse.json()
                    currentContent = getResult.data?.document?.parsedContent || currentContent
                  }
                }
                
                // Update tables (usually small)
                if (tables.length > 0) {
                  currentContent.tables = [...(currentContent.tables || []), ...tables]
                  const tablesSize = JSON.stringify({ parsedContent: currentContent }).length / (1024 * 1024)
                  if (tablesSize < VERCEL_LIMIT_MB) {
                    const tablesResponse = await fetch(`/api/documents/${documentId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ parsedContent: currentContent })
                    })
                    if (tablesResponse.ok) {
                      console.log(`✅ Updated tables for document ${documentId}`)
                      const getResponse = await fetch(`/api/documents/${documentId}`)
                      const getResult = await getResponse.json()
                      currentContent = getResult.data?.document?.parsedContent || currentContent
                    }
                  } else {
                    console.warn(`⚠️ Tables too large to update (${tablesSize.toFixed(2)}MB)`)
                  }
                }
                
                // Update images metadata (without data) - only if small enough
                if (images.length > 0) {
                  // Images metadata should be small (no base64), but check anyway
                  // Add empty data to satisfy type, API will ignore it for updates
                  const imagesWithEmptyData: ParsedContent['images'] = images.map(img => ({
                    filename: img.filename,
                    type: img.type,
                    position: img.position,
                    data: '' // Empty string to satisfy type, API ignores for PATCH updates
                  }))
                  const imagesOnlyContent = {
                    ...currentContent,
                    images: imagesWithEmptyData
                  }
                  const imagesSize = JSON.stringify({ parsedContent: imagesOnlyContent }).length / (1024 * 1024)
                  
                  if (imagesSize < VERCEL_LIMIT_MB) {
                    currentContent.images = imagesWithEmptyData
                    const imagesResponse = await fetch(`/api/documents/${documentId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ parsedContent: currentContent })
                    })
                    if (imagesResponse.ok) {
                      console.log(`✅ Updated images metadata for document ${documentId}`)
                      const getResponse = await fetch(`/api/documents/${documentId}`)
                      const getResult = await getResponse.json()
                      currentContent = getResult.data?.document?.parsedContent || currentContent
                    }
                  } else {
                    console.warn(`⚠️ Images metadata too large to update (${imagesSize.toFixed(2)}MB) - skipping images metadata`)
                    // Try to add image references to sections content instead
                    // This way images are at least mentioned in the document
                    if (currentContent.sections && currentContent.sections.length > 0) {
                      const imageReferences = images.map((img) => `![${img.filename}](image:${img.filename})`).join('\n')
                      // Add to first section
                      if (currentContent.sections[0].content) {
                        currentContent.sections[0].content += '\n\n' + imageReferences
                      } else {
                        currentContent.sections[0].content = imageReferences
                      }
                      // Try to update with image references in content
                      const withRefsSize = JSON.stringify({ parsedContent: currentContent }).length / (1024 * 1024)
                      if (withRefsSize < VERCEL_LIMIT_MB) {
                        const refsResponse = await fetch(`/api/documents/${documentId}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ parsedContent: currentContent })
                        })
                        if (refsResponse.ok) {
                          console.log(`✅ Added image references to document content`)
                        }
                      }
                    }
                  }
                }
                
                console.log(`✅ Finished updating parsedContent in parts for document ${documentId}`)
              } else {
                // Size is OK, update in one go
                const updateResponse = await fetch(`/api/documents/${documentId}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    parsedContent: mergedContent
                  })
                })
                
                if (!updateResponse.ok) {
                  const errorData = await updateResponse.json().catch(() => ({ message: 'Unknown error' }))
                  console.error(`❌ Failed to update parsedContent for document ${documentId}:`, errorData)
                  console.warn(`⚠️ Document ${documentId} was created but parsedContent could not be updated. Content may be incomplete.`)
                } else {
                  console.log(`✅ Updated parsedContent for document ${documentId}`)
                }
              }
            } catch (error) {
              console.error(`❌ Error updating parsedContent for document ${documentId}:`, error)
              console.warn(`⚠️ Document ${documentId} was created but parsedContent update failed. Content may be incomplete.`)
            }
          }
          
          // If images were not sent in payload, upload them separately now through backend API
          // This avoids CORS issues by routing uploads through the backend instead of direct browser uploads
          if (!sendImagesInPayload && file.parsedContent?.images && file.parsedContent.images.length > 0) {
            console.log(`📤 Uploading ${file.parsedContent.images.length} images through backend API for document ${documentId}...`)
            
            let uploadedCount = 0
            let skippedCount = 0
            let failedCount = 0
            
            const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB limit per image
            
            try {
              // Upload images one by one to avoid overwhelming the server
              for (const img of file.parsedContent.images) {
                if (!img.data || img.data.trim().length === 0) {
                  console.warn(`⚠️ Skipping image ${img.filename}: no data`)
                  skippedCount++
                  continue
                }
                
                try {
                  // Step 1: Convert base64 to binary to check size
                  let base64Data = img.data
                  if (base64Data.includes(',')) {
                    base64Data = base64Data.split(',')[1]
                  }
                  
                  // Estimate binary size (base64 is ~33% larger than binary)
                  const estimatedSize = (base64Data.length * 3) / 4
                  const sizeMB = estimatedSize / (1024 * 1024)
                  
                  // Check size limit before attempting upload
                  if (estimatedSize > MAX_IMAGE_SIZE) {
                    console.warn(`⚠️ Skipping image ${img.filename} - exceeds size limit (${sizeMB.toFixed(2)}MB). Maximum is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB per image.`)
                    skippedCount++
                    continue
                  }
                  
                  // Step 2: Upload through backend API (avoids CORS issues)
                  const uploadResponse = await fetch('/api/images/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      base64Data: img.data, // Send full data URL including prefix
                      filename: img.filename,
                      contentType: img.type || 'image/png',
                      folder: `documents/${documentId}`
                    })
                  })
                  
                  if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text()
                    let errorData
                    try {
                      errorData = JSON.parse(errorText)
                    } catch {
                      errorData = { message: errorText || uploadResponse.statusText }
                    }
                    console.error(`❌ Failed to upload ${img.filename} to Spaces:`, {
                      status: uploadResponse.status,
                      statusText: uploadResponse.statusText,
                      error: errorData,
                      size: `${sizeMB.toFixed(2)}MB`
                    })
                    failedCount++
                    continue
                  }
                  
                  const uploadResult = await uploadResponse.json()
                  if (!uploadResult.success || !uploadResult.data?.url) {
                    console.error(`❌ Invalid upload response for ${img.filename}:`, uploadResult)
                    failedCount++
                    continue
                  }
                  
                  const { url, key } = uploadResult.data
                  
                  console.log(`✅ Uploaded ${img.filename} to Spaces: ${url} (${sizeMB.toFixed(2)}MB)`)
                  
                  // Save image info to database and update parsedContent
                  try {
                    const saveImageResponse = await fetch(`/api/documents/${documentId}/images`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        images: [{
                          filename: img.filename,
                          url: url,
                          key: key,
                          type: img.type || 'image/png',
                          position: img.position
                        }]
                      })
                    })
                    
                    if (!saveImageResponse.ok) {
                      const errorText = await saveImageResponse.text()
                      console.error(`❌ Failed to save image ${img.filename} to database:`, {
                        status: saveImageResponse.status,
                        statusText: saveImageResponse.statusText,
                        error: errorText
                      })
                      failedCount++
                      continue
                    }
                    
                    const saveResult = await saveImageResponse.json()
                    if (saveResult.success) {
                      console.log(`✅ Saved image ${img.filename} to database`)
                      uploadedCount++
                    } else {
                      console.error(`❌ Failed to save image ${img.filename} to database:`, saveResult)
                      failedCount++
                    }
                  } catch (saveError) {
                    console.error(`❌ Error saving image ${img.filename} to database:`, saveError)
                    failedCount++
                  }
                } catch (uploadError) {
                  console.error(`❌ Error uploading image ${img.filename}:`, uploadError)
                  failedCount++
                }
              }
              
              console.log(`✅ Finished uploading images through backend API for document ${documentId}: ${uploadedCount} uploaded, ${skippedCount} skipped, ${failedCount} failed`)
              
              if (skippedCount > 0) {
                console.warn(`⚠️ ${skippedCount} image(s) were skipped (no data or size limit exceeded)`)
              }
              if (failedCount > 0) {
                console.warn(`⚠️ ${failedCount} image(s) failed to upload`)
              }
            } catch (error) {
              console.error(`❌ Error uploading images separately for document ${documentId}:`, error)
              // Don't fail the whole operation - document is already saved
            }
          }
          
          console.log('✅ Document saved successfully:', file.name, {
            documentId,
            title: result.data.document.title,
            hasParsedContent: !!result.data.document.parsedContent,
            source: file.name.includes('Google') ? 'Google Drive' : 'Local upload',
            hadWarning: !!file.warning,
            imagesSentInPayload: sendImagesInPayload
          })
          return result
        } catch (error) {
          console.error('Error saving document:', file.name, error)
          console.error('Error details:', {
            name: error instanceof Error ? error.name : typeof error,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          })
          // Update file status to show error
          setFiles(prev => prev.map(f => 
            f.id === file.id 
              ? { 
                  ...f, 
                  status: 'error' as const, 
                  error: error instanceof Error ? error.message : 'Failed to save document'
                }
              : f
          ))
          throw error
        }
      })

      // Wait for all saves to complete - use allSettled to handle partial failures
      console.log(`Starting to save ${savePromises.length} documents...`)
      const results = await Promise.allSettled(savePromises)
      
      // Check if all succeeded
      const failed = results.filter(r => r.status === 'rejected')
      const succeeded = results.filter(r => r.status === 'fulfilled')
      
      console.log(`Save results: ${succeeded.length} succeeded, ${failed.length} failed`)
      
      // Log detailed results
      if (succeeded.length > 0) {
        console.log('Successfully saved documents:', succeeded.map((r, idx) => {
          if (r.status === 'fulfilled' && r.value?.data?.document) {
            return { name: readyFiles[idx]?.name, id: r.value.data.document.id }
          }
          return { name: readyFiles[idx]?.name, status: 'fulfilled but no data' }
        }))
      }
      
      if (failed.length > 0) {
        console.error('Failed to save documents:', failed.map((r, idx) => {
          if (r.status === 'rejected') {
            return { 
              name: readyFiles[idx]?.name, 
              error: r.reason instanceof Error ? r.reason.message : String(r.reason)
            }
          }
          return { name: readyFiles[idx]?.name, status: 'unknown error' }
        }))
      }
      
      if (failed.length > 0) {
        // Some files failed - show specific error messages
        const errorMessages = failed.map((r, idx) => {
          if (r.status === 'rejected') {
            const errorMsg = r.reason instanceof Error ? r.reason.message : 'Unknown error'
            const file = readyFiles[idx]
            const fileSource = file?.name?.includes('Google') ? 'Google Drive' : 'local upload'
            console.error(`[Save Error] ${fileSource} file failed:`, {
              name: file?.name,
              error: errorMsg,
              hasParsedContent: !!file?.parsedContent
            })
            return file ? `${file.name}: ${errorMsg}` : errorMsg
          }
          return ''
        }).filter(Boolean)
        
        console.error('Document save errors:', errorMessages)
        
        // Показать toast для каждой ошибки
        errorMessages.forEach((msg) => {
          toast.error(msg, {
            duration: 6000
          })
        })
        
        setIsUploading(false)
        return // Don't redirect if there are failures
      }
      
      // All files saved successfully
      interface SaveResult {
        data?: {
          document?: {
            id: string
          }
        }
      }
      const savedDocumentIds = succeeded
        .filter((r): r is PromiseFulfilledResult<SaveResult> => 
          r.status === 'fulfilled' && !!r.value?.data?.document?.id
        )
        .map(r => r.value.data!.document!.id)
      
      console.log('✅ All documents saved successfully!', {
        total: succeeded.length,
        savedDocumentIds,
        files: succeeded.map((r, idx) => {
          const file = readyFiles[idx]
          return {
            name: file?.name,
            source: file?.name?.includes('Google') ? 'Google Drive' : 'local upload',
            documentId: r.status === 'fulfilled' && r.value?.data?.document?.id
          }
        })
      })
      
      // Show success toast BEFORE redirect (with longer duration to ensure visibility)
      toast.success(t('documentsSavedSuccessfully'), {
        description: `${succeeded.length} document(s) have been saved and will appear in your documents list`,
        duration: 4000
      })
      
      console.log('All documents saved successfully, waiting for DB commit...')
      
      // Wait a bit longer to ensure database transaction is committed
      // Also retry fetching documents in case of eventual consistency
      let documentsFetched = false
      let retryCount = 0
      const maxRetries = 3
      
      while (!documentsFetched && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 300 * (retryCount + 1)))
        
        try {
          console.log(`Fetching documents after save (attempt ${retryCount + 1}/${maxRetries})...`)
          const documentsResponse = await fetch('/api/documents', { 
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache'
            }
          })
          
          if (!documentsResponse.ok) {
            throw new Error(`HTTP ${documentsResponse.status}: ${documentsResponse.statusText}`)
          }
          
          const documentsResult = await documentsResponse.json()
          if (documentsResult.success && documentsResult.data?.documents && Array.isArray(documentsResult.data.documents)) {
            // Verify that at least one of the saved documents is in the response
            const foundDocuments = documentsResult.data.documents.filter((doc: { id: string }) => 
              savedDocumentIds.includes(doc.id)
            )
            
            console.log(`[Documents Fetch] Found ${foundDocuments.length} of ${savedDocumentIds.length} saved documents in response`)
            
            if (foundDocuments.length > 0 || retryCount === maxRetries - 1) {
              console.log(`[SessionStorage] Storing ${documentsResult.data.documents.length} documents (${foundDocuments.length} newly saved)`)
              if (typeof window !== 'undefined') {
                // Store in sessionStorage for immediate use by owner/manager page
                sessionStorage.setItem('pendingDocumentsRefresh', JSON.stringify({
                  data: documentsResult.data.documents,
                  timestamp: Date.now(),
                  savedDocumentIds: savedDocumentIds // Store IDs for verification
                }))
                console.log(`[SessionStorage] Documents stored successfully, timestamp: ${Date.now()}`)
              }
              documentsFetched = true
            } else {
              console.log(`[Documents Fetch] Not all saved documents found yet (found ${foundDocuments.length} of ${savedDocumentIds.length}), retrying...`)
              retryCount++
            }
          } else {
            console.error('[Documents Fetch] Failed to fetch documents - result not successful:', documentsResult)
            retryCount++
          }
        } catch (error) {
          console.error(`Failed to fetch documents after save (attempt ${retryCount + 1}):`, error)
          retryCount++
          if (retryCount >= maxRetries) {
            console.warn('Max retries reached, continuing anyway - owner/manager page will fetch on load')
            // Continue anyway - owner/manager page will fetch on load
            break
          }
        }
      }
      
      // Reset loading state before redirect
      setIsUploading(false)
      
      // Wait a moment to ensure toast is visible before redirect
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Redirect to the specified return URL with cache-busting
      // Add a timestamp to force fresh data load
      const timestamp = Date.now()
      const redirectUrl = safeReturnTo.includes('?') 
        ? `${safeReturnTo}&_t=${timestamp}`
        : `${safeReturnTo}?_t=${timestamp}`
      
      console.log(`[Redirect] Navigating to ${redirectUrl} with timestamp ${timestamp}`)
      
      // Use replace instead of push to avoid back button issues
      router.replace(redirectUrl)
      // Small delay to ensure navigation starts
      await new Promise(resolve => setTimeout(resolve, 100))
      router.refresh()
    } catch (error) {
      console.error('Error saving documents:', error)
      const errorMsg = error instanceof Error 
        ? `Failed to save documents: ${error.message}` 
        : 'Failed to save some documents. Please try again.'
      toast.error(errorMsg, {
        duration: 5000
      })
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
      onClose={() => {
        // Add timestamp to force data reload when closing
        const redirectUrl = safeReturnTo.includes('?') 
          ? `${safeReturnTo}&_t=${Date.now()}`
          : `${safeReturnTo}?_t=${Date.now()}`
        router.push(redirectUrl)
      }}
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
            <div className="mt-4 flex gap-2 justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenGooglePicker}
                disabled={isGooglePickerLoading || isPickerInitializing}
                className="gap-2 w-full sm:w-auto"
              >
                {isGooglePickerLoading || isPickerInitializing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('openingGoogleDrive')}
                  </>
                ) : (
                  <>
                    <img 
                      src="https://img.icons8.com/color/48/google-drive--v2.png" 
                      alt="Google Drive" 
                      className="h-4 w-4"
                    />
                    {t('importFromGoogleDrive')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>


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
                  <div key={file.id} className="p-4 border rounded-3xl space-y-3">
                    <div className="flex items-center justify-between">
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
                      <div className="flex items-center space-x-2 ml-4">
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
                    {file.warning && (
                      <div className="w-full p-2 bg-gray-50 dark:bg-gray-950/20 border border-gray-200 dark:border-gray-800 rounded-lg">
                        <p className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{file.warning}</span>
                        </p>
                      </div>
                    )}
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
