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

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB (images are stored separately in Spaces, only text content is counted)

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
        toast.error(`File type ${file.type} is not supported`, {
          description: 'Please upload DOCX or XLSX files only',
          duration: 5000
        })
        return
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        console.warn('[handleFiles] File too large:', file.size, 'max:', MAX_FILE_SIZE)
        toast.error(`File ${file.name} is too large`, {
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
      
      toast.success('File imported from Google Drive', {
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
        toast.error('Authorization failed', {
          description: 'Please try selecting the file again. Your access token may have expired.',
          duration: 6000
        })
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        toast.error('Access denied', {
          description: 'You may not have permission to access this file. Make sure you are signed in with the correct Google account.',
          duration: 6000
        })
      } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        toast.error('File not found', {
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
        toast.error('Google Drive не настроен', {
          description: 'Проверьте настройки GOOGLE_CLIENT_ID в .env.local',
          duration: 6000
        })
      } else if (errorMessage.includes('idpiframe_initialization_failed') ||
                 errorMessage.includes('OAuth initialization failed')) {
        toast.error('Ошибка инициализации OAuth', {
          description: 'Убедитесь, что ваш Google аккаунт добавлен как тестовый пользователь в OAuth Consent Screen в Google Cloud Console',
          duration: 8000
        })
      } else if (errorMessage.includes('access_denied') || 
                 errorMessage.includes('Access blocked') ||
                 errorMessage.includes('не прошло проверку')) {
        toast.error('Доступ заблокирован', {
          description: 'Приложение в режиме тестирования. Добавьте ваш email в Test users в Google Cloud Console или опубликуйте приложение. См. GOOGLE_OAUTH_TESTING_MODE_FIX.md',
          duration: 10000
        })
      } else if (errorMessage.includes('not loaded') || 
                 errorMessage.includes('API is not loaded') ||
                 errorMessage.includes('Failed to load')) {
        toast.error('Не удалось загрузить Google Picker', {
          description: 'Проверьте подключение к интернету и попробуйте снова',
          duration: 6000
        })
      } else if (errorMessage.includes('Authorization cancelled')) {
        // Не показывать ошибку, если пользователь отменил авторизацию
        return
      } else {
        toast.error(errorMessage, {
          duration: 5000
        })
      }
      
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
      toast.error('No files ready to save', {
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
          console.log('Image positions:', file.parsedContent.images.map((img: any) => ({ filename: img.filename, position: img.position })))
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
          
          // Prepare request body
          const requestBody = {
            title: file.name,
            originalFileName: file.name,
            fileType: file.type.split('/')[1],
            fileUrl: file.fileUrl || null, // Use Google Drive URL if available
            fileSize: file.size,
            parsedContent: file.parsedContent,
            parsingLog: file.parsingLog || null,
            uploadedBy: session?.user?.id || 'unknown'
          }
          
          // Check payload size before sending (only text content, images are excluded as they go to Spaces)
          // Create a copy of requestBody without images for size calculation
          const requestBodyWithoutImages = {
            ...requestBody,
            parsedContent: {
              ...requestBody.parsedContent,
              images: [] // Exclude images from size calculation
            }
          }
          const sizeCheckString = JSON.stringify(requestBodyWithoutImages)
          const payloadSizeMB = sizeCheckString.length / (1024 * 1024)
          const VERCEL_LIMIT_MB = 4.5
          
          console.log(`Payload size for ${file.name}: ${payloadSizeMB.toFixed(2)}MB (file: ${(file.size / (1024 * 1024)).toFixed(2)}MB, images excluded from size calculation)`)
          
          if (payloadSizeMB > VERCEL_LIMIT_MB) {
            const errorMsg = `Document "${file.name}" is too large (${payloadSizeMB.toFixed(2)}MB text content). Maximum text content size is ${VERCEL_LIMIT_MB}MB.`
            console.error(errorMsg)
            throw new Error(errorMsg)
          }
          
          // Send the original requestBody WITH images to the API
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
          
          console.log('✅ Document saved successfully:', file.name, {
            documentId: result.data.document.id,
            title: result.data.document.title,
            hasParsedContent: !!result.data.document.parsedContent,
            source: file.name.includes('Google') ? 'Google Drive' : 'Local upload',
            hadWarning: !!file.warning
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
      const savedDocumentIds = succeeded
        .filter(r => r.status === 'fulfilled' && r.value?.data?.document?.id)
        .map(r => (r.value as any).data.document.id)
      
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
      toast.success('Documents saved successfully', {
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
