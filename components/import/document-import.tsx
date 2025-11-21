"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  X, 
  RefreshCw
} from "lucide-react"
import { parseDocument, UnsupportedFileTypeError, FileReadError, ParseError, ParsedContent } from "@/lib/parsers"
import { clearParsingCache } from "@/lib/localStorage-utils"
import { useTranslation } from '@/lib/translation-context'
import { useUsageLimits } from "@/lib/hooks/use-usage-limits"
import { toast } from "sonner"

interface ParsingLog {
  level: 'info' | 'warning' | 'error'
  message: string
  line?: number
  cell?: string
}


interface DocumentImportProps {
  onImportComplete?: (moduleId: string) => void
}

export default function DocumentImport({ onImportComplete }: DocumentImportProps) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [parsingStatus, setParsingStatus] = useState<'idle' | 'uploading' | 'parsing' | 'completed' | 'error'>('idle')
  const [, setParsedContent] = useState<ParsedContent | null>(null)
  const [parsingLog, setParsingLog] = useState<ParsingLog[]>([])
  const { t } = useTranslation()
  const { limits } = useUsageLimits()
  const isImportDisabled = limits?.imports.expired ?? false

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/msword', // .doc
      'application/vnd.ms-excel' // .xls
    ]
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file type', {
        description: 'Please upload a DOCX or XLSX file',
        duration: 5000
      })
      return
    }

    // Validate file size (100MB limit - images are stored separately in Spaces, only text content is counted)
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File too large', {
        description: 'File size must be less than 100MB',
        duration: 5000
      })
      return
    }

    setSelectedFile(file)
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [handleFileSelect])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const startImport = async () => {
    if (!selectedFile) return

    if (isImportDisabled) {
      toast.error(
        `Import limit reached (${limits?.imports.current}/${limits?.imports.max}). Please upgrade your plan to continue.`,
        { duration: 5000 }
      )
      return
    }

    // Clear any cached parsing results to ensure fresh parsing
    console.log('Clearing parsing cache to ensure fresh parsing...')
    clearParsingCache()

    setParsingStatus('uploading')
    setUploadProgress(0)
    setParsingLog([])

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + Math.random() * 10
        })
      }, 200)

      // Simulate file upload
      await new Promise(resolve => setTimeout(resolve, 1000))
      clearInterval(progressInterval)
      setUploadProgress(100)

      setParsingStatus('parsing')
      
      // Add parsing log entries
      const logs: ParsingLog[] = [
        { level: 'info', message: 'Document uploaded successfully' },
        { level: 'info', message: `Parsing ${selectedFile.name}...` }
      ]
      setParsingLog(logs)

      // Parse the document using the real parser
      console.log('Starting document parse for:', selectedFile.name, 'Size:', selectedFile.size, 'Type:', selectedFile.type)
      const parsedContent = await parseDocument(selectedFile)
      console.log('Document parsed successfully:', parsedContent)
      
      // Add completion log
      logs.push(
        { level: 'info', message: `Extracted ${parsedContent.metadata.totalSections} sections and ${parsedContent.metadata.totalTables} tables` },
        { level: 'info', message: 'Parsing completed successfully' }
      )

      setParsedContent(parsedContent)
      setParsingLog(logs)
      setParsingStatus('completed')
      
      // Call the completion callback if provided
      if (onImportComplete) {
        onImportComplete('imported-document')
      }

    } catch (err) {
      let errorMessage = 'Failed to parse document. Please try again.'
      
      if (err instanceof UnsupportedFileTypeError) {
        errorMessage = `Unsupported file type. Please upload a DOCX or XLSX file.`
      } else if (err instanceof FileReadError) {
        errorMessage = `File read error: ${err.message}`
      } else if (err instanceof ParseError) {
        errorMessage = `Parse error: ${err.message}`
      }
      
      setParsingStatus('error')
      
      // Показать ошибку в toast
      toast.error(errorMessage, {
        duration: 5000
      })
      
      // Add error to parsing log
      setParsingLog(prev => [
        ...prev,
        { level: 'error', message: errorMessage }
      ])
    }
  }

  const resetImport = () => {
    setSelectedFile(null)
    setParsingStatus('idle')
    setUploadProgress(0)
    setParsedContent(null)
    setParsingLog([])
  }

  const getStatusIcon = () => {
    switch (parsingStatus) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'parsing':
      case 'uploading':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <Upload className="h-5 w-5 text-muted-foreground" />
    }
  }


  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            {t('documentImport')}
          </CardTitle>
          <CardDescription>
            {t('uploadDocxXlsxFiles')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedFile ? (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">{t('dropYourFileHere')}</p>
              <p className="text-muted-foreground mb-4">
                {t('supportsDocxXlsx20MB')}
              </p>
              <input
                type="file"
                accept=".docx,.xlsx,.doc,.xls"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <Button asChild>
                <label htmlFor="file-upload" className="cursor-pointer">
                  {t('chooseFile')}
                </label>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
               <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent">
                 <div>
                   <p className="font-medium text-foreground">{selectedFile.name}</p>
                   <p className="text-sm text-muted-foreground">
                     {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                   </p>
                 </div>
                 <Button variant="ghost" size="sm" onClick={resetImport} className="text-muted-foreground hover:text-foreground">
                   <X className="h-4 w-4" />
                 </Button>
               </div>

              {parsingStatus === 'uploading' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full h-2" />
                </div>
              )}

              {parsingStatus === 'parsing' && (
                <div className="flex items-center gap-2 text-blue-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Parsing document structure...</span>
                </div>
              )}

              {parsingStatus === 'completed' && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Document imported successfully! You can now view it in the Docs section.
                  </AlertDescription>
                </Alert>
              )}


              <div className="flex gap-2">
                {parsingStatus === 'idle' && (
                  <div 
                    onClick={(e) => {
                      if (isImportDisabled && selectedFile) {
                        e.preventDefault()
                        e.stopPropagation()
                        startImport()
                      }
                    }}
                    className={isImportDisabled && selectedFile ? "flex-1 cursor-pointer" : "flex-1"}
                  >
                    <Button 
                      onClick={startImport} 
                      className="flex-1 w-full"
                      disabled={isImportDisabled || !selectedFile}
                    >
                      Import Document
                    </Button>
                  </div>
                )}
                
                {parsingStatus === 'completed' && (
                  <>
                    <Button variant="outline" onClick={resetImport} className="flex-1">
                      {t('importAnother')}
                    </Button>
                  </>
                )}
                
                {parsingStatus === 'error' && (
                  <>
                    <Button 
                      onClick={startImport} 
                      className="flex-1"
                    >
                      Try Again
                    </Button>
                    <Button variant="outline" onClick={resetImport}>
                      Import Another
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parsing Log */}
      {parsingLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Parsing Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {parsingLog.map((log, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  {log.level === 'error' && <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />}
                  {log.level === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />}
                  {log.level === 'info' && <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />}
                  <div className="flex-1">
                    <span className={log.level === 'error' ? 'text-red-600' : log.level === 'warning' ? 'text-yellow-600' : 'text-gray-600'}>
                      {log.message}
                    </span>
                    {log.line && (
                      <span className="text-muted-foreground ml-2">(Line {log.line})</span>
                    )}
                    {log.cell && (
                      <span className="text-muted-foreground ml-2">(Cell {log.cell})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
