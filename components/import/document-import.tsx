"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Eye,
  Download,
  RefreshCw
} from "lucide-react"
import { parseDocument, UnsupportedFileTypeError, FileReadError, ParseError, ParsedContent } from "@/lib/parsers"

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
  const [parsedContent, setParsedContent] = useState<ParsedContent | null>(null)
  const [parsingLog, setParsingLog] = useState<ParsingLog[]>([])
  const [error, setError] = useState<string | null>(null)

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
  }, [])

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/msword', // .doc
      'application/vnd.ms-excel' // .xls
    ]
    
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a DOCX or XLSX file')
      return
    }

    // Validate file size (20MB limit)
    if (file.size > 20 * 1024 * 1024) {
      setError('File size must be less than 20MB')
      return
    }

    setSelectedFile(file)
    setError(null)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const startImport = async () => {
    if (!selectedFile) return

    setParsingStatus('uploading')
    setUploadProgress(0)
    setParsingLog([])
    setError(null)

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

    } catch (err) {
      let errorMessage = 'Failed to parse document. Please try again.'
      
      if (err instanceof UnsupportedFileTypeError) {
        errorMessage = `Unsupported file type. Please upload a DOCX or XLSX file.`
      } else if (err instanceof FileReadError) {
        errorMessage = `File read error: ${err.message}`
      } else if (err instanceof ParseError) {
        errorMessage = `Parse error: ${err.message}`
      }
      
      setError(errorMessage)
      setParsingStatus('error')
      
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
    setError(null)
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
        return <Upload className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusText = () => {
    switch (parsingStatus) {
      case 'uploading':
        return 'Uploading file...'
      case 'parsing':
        return 'Parsing document structure...'
      case 'completed':
        return 'Import completed successfully'
      case 'error':
        return 'Import failed'
      default:
        return 'Ready to import'
    }
  }

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Document Import
          </CardTitle>
          <CardDescription>
            Upload DOCX or XLSX files to create structured training modules
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
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">Drop your file here</p>
              <p className="text-gray-500 mb-4">
                Supports DOCX and XLSX files up to 20MB
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
                  Choose File
                </label>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={resetImport}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {parsingStatus === 'uploading' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
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
                    Document parsed successfully! Review the structure below and click "Create Module" to proceed.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={startImport} 
                  disabled={parsingStatus === 'uploading' || parsingStatus === 'parsing'}
                  className="flex-1"
                >
                  {parsingStatus === 'idle' ? 'Import Document' : getStatusText()}
                </Button>
                {parsingStatus === 'completed' && (
                  <Button variant="outline" onClick={resetImport}>
                    Import Another
                  </Button>
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
                      <span className="text-gray-400 ml-2">(Line {log.line})</span>
                    )}
                    {log.cell && (
                      <span className="text-gray-400 ml-2">(Cell {log.cell})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Preview */}
      {parsedContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Content Structure Preview
            </CardTitle>
            <CardDescription>
              Review the parsed content structure before creating the module
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {parsedContent.metadata.totalSections}
                  </div>
                  <div className="text-sm text-blue-600">Sections</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {parsedContent.metadata.totalTables}
                  </div>
                  <div className="text-sm text-green-600">Tables</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {parsedContent.metadata.wordCount}
                  </div>
                  <div className="text-sm text-purple-600">Words</div>
                </div>
              </div>

              {/* Sections Preview */}
              <div>
                <h4 className="font-medium mb-3">Document Sections</h4>
                <div className="space-y-2">
                  {parsedContent.sections.map((section, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <Badge variant="outline" className="text-xs">
                        H{section.level}
                      </Badge>
                      <span className="text-sm font-medium">{section.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tables Preview */}
              {parsedContent.tables.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Tables Found</h4>
                  <div className="space-y-2">
                    {parsedContent.tables.map((table, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded">
                        <div className="font-medium text-sm mb-1">{table.title}</div>
                        <div className="text-xs text-gray-500">
                          {table.headers.length} columns × {table.rows.length} rows
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button className="flex-1">
                  Create Module
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Preview
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
