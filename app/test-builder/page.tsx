"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useEffect, useState, useCallback, useLayoutEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TestTypeBadge } from "@/lib/badges"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ErrorMessage } from "@/components/common/error-message"
import { FormField } from "@/components/common/form-field"
import { useTranslation } from "@/lib/translation-context"
import { useFormValidation } from "@/lib/hooks/use-form-validation"
import { validationRules } from "@/lib/validation"
import { toast } from "sonner"
import { 
  FileText, 
  X,
  TestTube,
  Loader2,
  Trash2,
  Plus,
  Save
} from "lucide-react"
import type { 
  Document, 
  TestConfig, 
  Context, 
  GeneratedQuestion, 
  QuestionType, 
  DifficultyLevel, 
  Locale 
} from "@/types/test"

// Documents will be loaded from API

const questionTypes: QuestionType[] = [
  { value: "mcq", label: "Multiple Choice (Single)" },
  { value: "mcq_multi", label: "Multiple Choice (Multiple)" },
  { value: "tf", label: "True/False" },
  { value: "complete", label: "Fill in the Blank" },
  { value: "cloze", label: "Cloze Test" },
  { value: "match", label: "Matching" },
  { value: "order", label: "Ordering" },
  { value: "mixed", label: "Mixed Types" }
]

const difficultyLevels: DifficultyLevel[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" }
]

const locales: Locale[] = [
  { value: "ru", label: "Russian" },
  { value: "en", label: "English" }
]

export default function TestBuilderPage() {
  const { data: session, status } = useSession()
  const { t } = useTranslation()
  const router = useRouter()
  
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  
  // Validation state
  const initialFormData = {
    documentId: "",
    count: 5,
    type: "mcq" as string,
    difficulty: "medium" as string,
    locale: "ru" as string
  }
  
  const validation = useFormValidation({
    documentId: [validationRules.required],
    count: [
      validationRules.required,
      validationRules.integer,
      validationRules.min(1),
      validationRules.max(20)
    ],
    type: [validationRules.required],
    difficulty: [validationRules.required],
    locale: [validationRules.required]
  }, initialFormData)
  
  const { values, errors, touched, setValue, setFieldTouched, validateAll } = validation
  
  const testConfig: TestConfig = {
    count: values.count || 5,
    type: values.type || 'mcq',
    difficulty: values.difficulty || 'medium',
    locale: values.locale || 'en'
  }
  const [context, setContext] = useState<Context>({
    text: "",
    facts: [],
    steps: [],
    definitions: []
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [aiProvider, setAiProvider] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingTestId, setEditingTestId] = useState<string | null>(null)
  const [originalQuestionCount, setOriginalQuestionCount] = useState(0)

  // Load documents from API - use useLayoutEffect for faster initial load
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    
    const loadDocuments = async () => {
      try {
        const response = await fetch('/api/documents', { cache: 'no-store' })
        const result = await response.json()
        
        if (result.success) {
          const docs = result.data.documents.map((doc: {
            id: string | number
            title: string
            originalFileName?: string
            fileType?: string
            [key: string]: unknown
          }) => ({
            ...doc,
            id: String(doc.id) // Ensure ID is always a string for consistency
          }))
          setDocuments(docs)
        } else {
          console.error('Failed to load documents:', result.message)
          setDocuments([])
        }
      } catch (error) {
        console.error('Error loading documents:', error)
        setDocuments([])
      }
    }

    loadDocuments()
  }, [])

  // When in edit mode and we have a selectedDocument but it's not in documents list,
  // ensure it gets added and selected
  useEffect(() => {
    if (isEditMode && selectedDocument && documents.length > 0) {
      const docExists = documents.find(d => String(d.id) === String(selectedDocument.id))
      if (!docExists) {
        console.log('Selected document not in list, adding it:', selectedDocument.id)
        setDocuments(prevDocs => {
          const exists = prevDocs.find(d => String(d.id) === String(selectedDocument.id))
          if (!exists) {
            return [...prevDocs, selectedDocument]
          }
          return prevDocs
        })
      }
    }
  }, [isEditMode, selectedDocument, documents])

  // Ensure documentId is synced with selectedDocument
  useEffect(() => {
    if (selectedDocument && values.documentId !== String(selectedDocument.id)) {
      console.log('Syncing documentId with selectedDocument:', selectedDocument.id, 'current:', values.documentId)
      setValue('documentId', String(selectedDocument.id))
    }
  }, [selectedDocument])

  // Ensure document is selected when documentId is set and document exists in list
  useEffect(() => {
    if (values.documentId && documents.length > 0 && !selectedDocument) {
      const doc = documents.find(d => String(d.id) === String(values.documentId))
      if (doc) {
        console.log('Found document for documentId:', values.documentId, doc.title)
        setSelectedDocument(doc)
      } else {
        console.log('Document not found in list for documentId:', values.documentId, 'Available IDs:', documents.map(d => d.id))
      }
    }
  }, [values.documentId, documents, selectedDocument])

  const loadTestForEditing = useCallback(async (testId: string) => {
    try {
      console.log('Test Builder: Loading test for editing, testId:', testId)
      const response = await fetch(`/api/tests/${testId}`)
      const result = await response.json()
      
      console.log('Test Builder: Test API response:', result)
      
      if (result.success && result.data.test) {
        const test = result.data.test
        const questions = result.data.questions || []
        
        console.log('Test Builder: Test data:', test)
        console.log('Test Builder: Test moduleId:', test.moduleId)
        console.log('Test Builder: Questions count:', questions.length)
        
        // Load test configuration - use saved test data
        const loadedConfig = {
          count: test.questionIds?.length || 5,
          type: test.type || (questions.length > 0 ? questions[0].type || 'mcq' : 'mcq'),
          difficulty: test.difficulty || (questions.length > 0 ? questions[0].difficulty || 'medium' : 'medium'),
          locale: test.locale || 'en'
        }
        
        // Update validation values for test config - documentId will be set when document loads
        validation.setValue('count', loadedConfig.count)
        validation.setValue('type', loadedConfig.type)
        validation.setValue('difficulty', loadedConfig.difficulty)
        validation.setValue('locale', loadedConfig.locale)

        // Load document if available
        // Note: test.moduleId might be a document ID (when created via test builder)
        // or a module ID (if created via other means)
        if (test.moduleId) {
          console.log('Test Builder: Loading document with moduleId:', test.moduleId)
          try {
            // First try to fetch as document ID (most common case)
            const docResponse = await fetch(`/api/documents/${test.moduleId}`)
            const docResult = await docResponse.json()
            
            console.log('Test Builder: Document API response:', docResult)
            
            if (docResult.success && docResult.data.document) {
              const document = docResult.data.document
              console.log('Test Builder: Found document:', document.id, document.title)
              
              const documentToSet = {
                id: String(document.id), // Ensure ID is always a string
                title: document.title,
                originalFileName: document.originalFileName,
                fileType: document.fileType,
                fileUrl: document.fileUrl,
                fileSize: document.fileSize,
                parsedContent: document.parsedContent,
                parsingLog: document.parsingLog,
                status: document.status,
                uploadedBy: document.uploadedBy,
                createdAt: document.createdAt,
                updatedAt: document.updatedAt
              }
              
              console.log('Test Builder: Document to set:', documentToSet)
              console.log('Test Builder: Document ID as string:', String(documentToSet.id))
              
              // Ensure the document is in the documents list for the Select dropdown FIRST
              let documentExists = false
              setDocuments(prevDocs => {
                console.log('Test Builder: Current documents list length:', prevDocs.length)
                const existingDoc = prevDocs.find(d => String(d.id) === String(documentToSet.id))
                if (existingDoc) {
                  documentExists = true
                  console.log('Test Builder: Document already in list:', documentToSet.id)
                  return prevDocs
                } else {
                  // Add document to list if not present
                  console.log('Test Builder: Adding document to documents list:', documentToSet.id)
                  return [...prevDocs, documentToSet]
                }
              })
              
              // Set form values first
              setValue('count', loadedConfig.count)
              setValue('type', loadedConfig.type)
              setValue('difficulty', loadedConfig.difficulty)
              setValue('locale', loadedConfig.locale)
              setValue('documentId', String(documentToSet.id))
              
              // Set selected document - use setTimeout to ensure document is in list
              setTimeout(() => {
                console.log('Test Builder: Setting selectedDocument to:', documentToSet.id)
                console.log('Test Builder: Document ID as string:', String(documentToSet.id))
                console.log('Test Builder: Current documents count:', documents.length)
                setSelectedDocument(documentToSet)
              }, documentExists ? 0 : 150)
              
              // Use actual document content from parsedContent
              let documentContent = ''
              
              // Extract content from sections
              if (Array.isArray(document.parsedContent?.sections) && document.parsedContent!.sections.length > 0) {
                type Section = { content: string; title?: string }
                documentContent = document.parsedContent.sections
                  .map((section: Section) => `${section.title ? section.title + '\n' : ''}${section.content}`)
                  .join('\n\n')
              }
              
              // Extract content from tables (for xlsx files)
              if (Array.isArray(document.parsedContent?.tables) && document.parsedContent!.tables.length > 0) {
                const tablesContent = document.parsedContent.tables
                  .map((table: { title: string; headers: string[]; rows: string[][] }) => {
                    let tableText = `${table.title}\n`
                    
                    // Add headers if they exist
                    if (table.headers && table.headers.some(h => h)) {
                      tableText += table.headers.join(' | ') + '\n'
                    }
                    
                    // Add rows
                    table.rows.forEach(row => {
                      if (row && row.some(cell => cell)) {
                        tableText += row.join(' | ') + '\n'
                      }
                    })
                    
                    return tableText
                  })
                  .join('\n\n')
                
                documentContent += (documentContent ? '\n\n' : '') + tablesContent
              }
              
              // If no parsed content, document content is not available
              if (!documentContent) {
                documentContent = ''
              }
              setContext(prev => ({
                ...prev,
                text: documentContent,
                facts: extractFacts(documentContent),
                steps: extractSteps(documentContent),
                definitions: extractDefinitions(documentContent)
              }))
            } else {
              console.warn('Test Builder: Failed to load document for test.moduleId:', test.moduleId, 'Response:', docResult)
            }
          } catch (error) {
            console.error('Error loading document for editing:', error)
            // If document fetch fails, try to find it in the documents list by ID
            setDocuments(prevDocs => {
              const docInList = prevDocs.find(d => String(d.id) === String(test.moduleId))
              if (docInList) {
                // Document already in list, set it as selected
                const docObj = {
                  id: docInList.id,
                  title: docInList.title,
                  originalFileName: docInList.originalFileName,
                  fileType: docInList.fileType,
                  fileUrl: docInList.fileUrl || '',
                  fileSize: docInList.fileSize || 0,
                  parsedContent: docInList.parsedContent || undefined,
                  parsingLog: docInList.parsingLog || undefined,
                  status: docInList.status || 'ready',
                  uploadedBy: docInList.uploadedBy || '',
                  createdAt: docInList.createdAt,
                  updatedAt: docInList.updatedAt
                }
                // Set selectedDocument and documentId synchronously
                setSelectedDocument(docObj)
                validation.setValue('documentId', String(docObj.id))
                validation.setValue('count', loadedConfig.count)
                validation.setValue('type', loadedConfig.type)
                validation.setValue('difficulty', loadedConfig.difficulty)
                validation.setValue('locale', loadedConfig.locale)
              }
              return prevDocs
            })
          }
        }

        // Load existing questions
        if (questions.length > 0) {
          const transformedQuestions: GeneratedQuestion[] = questions.map((q: {
            id: string
            type?: string
            content?: string
            title?: string
            options?: string[]
            correctAnswer?: string
            explanation?: string
          }) => ({
            id: q.id,
            type: q.type || 'mcq',
            prompt: q.content || q.title || 'Question',
            choices: q.options || ['A', 'B', 'C', 'D'],
            correct_answer: q.correctAnswer || 'A',
            explanation: q.explanation || 'No explanation provided'
          }))
          setGeneratedQuestions(transformedQuestions)
          setOriginalQuestionCount(transformedQuestions.length)
        } else {
          // No questions found, set empty
          setGeneratedQuestions([])
          setOriginalQuestionCount(0)
        }
      }
    } catch (error) {
      console.error('Test Builder: Error loading test for editing:', error)
      setError(t('failedToLoadTest'))
    }
  }, [])

  // Track if we've already loaded the test to prevent multiple loads
  const [testLoaded, setTestLoaded] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Check if we're in edit mode via URL parameter
    const urlParams = new URLSearchParams(window.location.search)
    const editingId = urlParams.get('edit')
    if (editingId && !testLoaded) {
      console.log('Test Builder: Edit mode detected, editingId:', editingId)
      console.log('Test Builder: Documents count:', documents.length)
      setIsEditMode(true)
      setEditingTestId(editingId)
      
      // Load test immediately - loadTestForEditing will handle document loading if needed
      console.log('Test Builder: Loading test for editing...')
      loadTestForEditing(editingId).then(() => {
        setTestLoaded(true)
      })
    }
  }, [session, status, router, loadTestForEditing, documents.length, testLoaded])

  // Enhanced language detection based on Cyrillic characters and common patterns
  const detectLanguage = (text: string): 'ru' | 'en' => {
    if (!text || text.length === 0) return 'en' // Default to English
    
    // Count Cyrillic characters (Russian)
    const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) || []).length
    const totalChars = text.replace(/[^\w]/g, '').length
    
    // If more than 10% Cyrillic, assume Russian
    if (totalChars > 0 && (cyrillicCount / totalChars) > 0.1) {
      return 'ru'
    }
    
    return 'en'
  }

  // Get document language - prioritize metadata, then detection
  const getDocumentLanguage = (doc: Document): 'ru' | 'en' => {
    // First check metadata
    const metadataLocale = doc.parsedContent?.metadata?.language || doc.parsedContent?.metadata?.locale
    if (metadataLocale && (metadataLocale === 'ru' || metadataLocale === 'en')) {
      return metadataLocale as 'ru' | 'en'
    }
    
    // Then detect from content
    let documentContent = ''
    if (Array.isArray(doc.parsedContent?.sections) && doc.parsedContent!.sections.length > 0) {
      type Section = { content: string; title?: string }
      documentContent = doc.parsedContent.sections
        .map((section: Section) => `${section.title ? section.title + '\n' : ''}${section.content}`)
        .join('\n\n')
    }
    
    if (documentContent) {
      return detectLanguage(documentContent)
    }
    
    return 'en' // Default fallback
  }

  const handleDocumentSelect = (doc: Document) => {
    setSelectedDocument(doc)
    setValue('documentId', doc.id)
    setFieldTouched('documentId')
    // Use actual document content from parsedContent
    let documentContent = ''
    
    // Extract content from sections
    if (Array.isArray(doc.parsedContent?.sections) && doc.parsedContent!.sections.length > 0) {
      type Section = { content: string; title?: string }
      documentContent = doc.parsedContent.sections
        .map((section: Section) => `${section.title ? section.title + '\n' : ''}${section.content}`)
        .join('\n\n')
    }
    
    // Extract content from tables (for xlsx files)
    if (Array.isArray(doc.parsedContent?.tables) && doc.parsedContent!.tables.length > 0) {
      const tablesContent = doc.parsedContent.tables
        .map((table: { title: string; headers: string[]; rows: string[][] }) => {
          let tableText = `${table.title}\n`
          
          // Add headers if they exist
          if (table.headers && table.headers.some(h => h)) {
            tableText += table.headers.join(' | ') + '\n'
          }
          
          // Add rows
          table.rows.forEach(row => {
            if (row && row.some(cell => cell)) {
              tableText += row.join(' | ') + '\n'
            }
          })
          
          return tableText
        })
        .join('\n\n')
      
      documentContent += (documentContent ? '\n\n' : '') + tablesContent
    }
    
    // If no parsed content, document content is not available
    if (!documentContent) {
      documentContent = ''
    }
    
    // Auto-detect and set language from document - use getDocumentLanguage for consistency
    const documentLocale = getDocumentLanguage(doc)
    setValue('locale', documentLocale)
    setFieldTouched('locale')
    
    setContext(prev => ({
      ...prev,
      text: documentContent,
      facts: extractFacts(documentContent),
      steps: extractSteps(documentContent),
      definitions: extractDefinitions(documentContent)
    }))
  }


  // Extract facts from document content
  const extractFacts = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim())
    return lines.slice(0, 5) // Take first 5 non-empty lines as facts
  }

  // Extract process steps from document content
  const extractSteps = (content: string) => {
    const lines = content.split('\n')
    return lines
      .filter(line => line.trim().match(/^\d+\.|^-\s|^\*\s/)) // Lines starting with numbers, dashes, or asterisks
      .slice(0, 5)
      .map(line => line.trim())
  }

  // Extract definitions from document content
  const extractDefinitions = (content: string) => {
    const lines = content.split('\n')
    return lines
      .filter(line => line.includes(':') && line.length > 10) // Lines with colons (likely definitions)
      .slice(0, 3)
      .map(line => line.trim())
  }


  const generateHmacSignature = (data: Record<string, unknown>, secret: string) => {
    // Note: In a real app, you'd use a proper crypto library
    // This is just a placeholder for the HMAC signature
    // Simple hash-like string generation that handles Unicode
    const dataString = JSON.stringify(data) + secret
    let hash = 0
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  const handleGenerateTest = async () => {
    // Validate all fields before generating
    if (!validateAll()) {
      setError(t('pleaseFixErrors'))
      return
    }
    
    if (!selectedDocument) {
      setError(t('pleaseSelectDocument'))
      return
    }

    // Ensure locale matches document language - override user selection if needed
    const documentLocale = getDocumentLanguage(selectedDocument)
    if (testConfig.locale !== documentLocale) {
      console.log(`Language mismatch detected. Document language: ${documentLocale}, Selected: ${testConfig.locale}. Using document language.`)
      setValue('locale', documentLocale)
      setFieldTouched('locale')
    }

    setIsGenerating(true)
    setError(null)

    try {
      // Use document language for generation (not user-selected locale if it differs)
      const generationConfig = {
        ...testConfig,
        locale: documentLocale // Force use document language
      }

      const requestData = {
        params: generationConfig,
        context: {
          text: context.text,
          facts: context.facts.filter(f => f.trim()),
          steps: context.steps.filter(s => s.trim()),
          definitions: context.definitions.filter(d => d.trim())
        },
        sourceRefs: [selectedDocument.title || selectedDocument.originalFileName || 'Untitled Document']
      }

      // Generate HMAC signature (placeholder for demo)
      const hmacSecret = process.env.NEXT_PUBLIC_HMAC_SECRET || "test-secret-key"
      generateHmacSignature(requestData, hmacSecret) // Signature generated but not used in demo

      const response = await fetch('/api/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        let errorMessage = 'Failed to generate questions'
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.message || errorMessage
          
          if (errorJson.debug) {
            const debug = errorJson.debug
            const debugParts: string[] = []
            
            if (!debug.hasApiKey) {
              debugParts.push('GROK_API_KEY is not set in environment variables')
            } else {
              debugParts.push(`API key is set (length: ${debug.apiKeyLength})`)
            }
            
            if (debug.lastStatus) {
              debugParts.push(`Last HTTP status: ${debug.lastStatus}`)
            }
            
            if (debug.errorsByModel && Object.keys(debug.errorsByModel).length > 0) {
              debugParts.push(`Errors by model: ${JSON.stringify(debug.errorsByModel, null, 2)}`)
            }
            
            if (debug.modelsAttempted) {
              debugParts.push(`Models attempted: ${debug.modelsAttempted.join(', ')}`)
            }
            
            errorMessage += '\n\nDebug info:\n' + debugParts.join('\n')
          }
          
          if (errorJson.error) {
            errorMessage += `\n\nError details: ${errorJson.error}`
          }
        } catch {
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()

      if (!result.success) {
        // Build detailed error message from API response
        let errorMessage = result.message || 'Failed to generate questions'
        
        if (result.debug) {
          const debug = result.debug
          const debugParts: string[] = []
          
          if (!debug.hasApiKey) {
            debugParts.push('GROK_API_KEY is not set in environment variables')
          } else {
            debugParts.push(`API key is set (length: ${debug.apiKeyLength})`)
          }
          
          if (debug.lastStatus) {
            debugParts.push(`Last HTTP status: ${debug.lastStatus}`)
          }
          
          if (debug.errorsByModel && Object.keys(debug.errorsByModel).length > 0) {
            debugParts.push(`Errors by model: ${JSON.stringify(debug.errorsByModel, null, 2)}`)
          }
          
          if (debug.modelsAttempted) {
            debugParts.push(`Models attempted: ${debug.modelsAttempted.join(', ')}`)
          }
          
          errorMessage += '\n\nDebug info:\n' + debugParts.join('\n')
        }
        
        if (result.error) {
          errorMessage += `\n\nError details: ${result.error}`
        }
        
        throw new Error(errorMessage)
      }
      
      const newQuestions = result.data?.questions || []
      // Always add new questions to existing ones (never replace)
      setGeneratedQuestions(prev => [...prev, ...newQuestions])
      setAiProvider(result.provider || 'unknown')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate test'
      console.error('Test generation error:', err)
      setError(errorMessage)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClose = () => {
    // Redirect based on returnTo parameter or user role
    const urlParams = new URLSearchParams(window.location.search)
    const returnTo = urlParams.get('returnTo')
    
    // Add timestamp parameter to force data reload
    const addTimestamp = (url: string) => {
      return url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`
    }
    
    if (returnTo) {
      router.push(addTimestamp(returnTo))
    } else {
      // Fallback: redirect based on user role
      const userRole = session?.user?.role
      if (userRole === 'owner') {
        router.push(addTimestamp('/owner?tab=tests'))
      } else {
        router.push(addTimestamp('/manager?tab=tests'))
      }
    }
  }


  const handleUpdateQuestionField = (questionId: string, field: keyof GeneratedQuestion, value: string | string[]) => {
    setGeneratedQuestions(prev => 
      prev.map(q => q.id === questionId ? { ...q, [field]: value } : q)
    )
  }

  const handleUpdateChoice = (questionId: string, choiceIndex: number, value: string) => {
    setGeneratedQuestions(prev => 
      prev.map(q => 
        q.id === questionId 
          ? { 
              ...q, 
              choices: q.choices?.map((choice: string, index: number) => 
                index === choiceIndex ? value : choice
              ) || []
            } 
          : q
      )
    )
  }

  const handleDeleteQuestion = (questionId: string) => {
    setGeneratedQuestions(prev => prev.filter(q => q.id !== questionId))
  }

  const handleDeleteChoice = (questionId: string, choiceIndex: number) => {
    setGeneratedQuestions(prev => 
      prev.map(q => 
        q.id === questionId 
          ? { 
              ...q, 
              choices: q.choices?.filter((_: string, index: number) => index !== choiceIndex) || []
            } 
          : q
      )
    )
  }

  const handleAddChoice = (questionId: string) => {
    setGeneratedQuestions(prev => 
      prev.map(q => 
        q.id === questionId 
          ? { 
              ...q, 
              choices: [...(q.choices || []), t('newChoice')]
            } 
          : q
      )
    )
  }

  const handleClearAllQuestions = () => {
    if (confirm(t('clearAllQuestions'))) {
      setGeneratedQuestions([])
    }
  }

  const handleSaveTest = async () => {
    if (generatedQuestions.length === 0) {
      setError(t('noQuestionsToSave'))
      return
    }

    if (!selectedDocument) {
      setError(t('pleaseSelectDocumentForSave'))
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      if (isEditMode && editingTestId) {
        // Update existing test
        const response = await fetch(`/api/tests/${editingTestId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: `${selectedDocument.title || selectedDocument.originalFileName || 'Untitled Document'} - Test`,
            description: `Test generated from ${selectedDocument.title || selectedDocument.originalFileName || 'Untitled Document'}`,
            questionIds: generatedQuestions.map(q => q.id),
            type: testConfig.type,
            difficulty: testConfig.difficulty,
            locale: testConfig.locale,
            passingScore: 70,
            timeLimit: 15,
            maxAttempts: 1,
            shuffleQuestions: false,
            showCorrectAnswers: true,
            status: 'published'
          })
        })

        if (!response.ok) {
          throw new Error('Failed to update test')
        }

        toast.success(`Test updated successfully! ${generatedQuestions.length} questions updated.`)
      } else {
        // Create new test
        const response = await fetch('/api/tests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: `${selectedDocument.title || selectedDocument.originalFileName || 'Untitled Document'} - Test`,
            description: `Test generated from ${selectedDocument.title || selectedDocument.originalFileName || 'Untitled Document'}`,
            moduleId: selectedDocument.id,
            questions: generatedQuestions, // Send the actual question objects
            type: testConfig.type,
            difficulty: testConfig.difficulty,
            locale: testConfig.locale,
            passingScore: 70,
            timeLimit: 15,
            maxAttempts: 1,
            shuffleQuestions: false,
            showCorrectAnswers: true,
            status: 'published'
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to create test', error: 'Unknown error' }))
          console.error('Test creation error:', errorData)
          throw new Error(errorData.message || errorData.error || 'Failed to create test')
        }

        toast.success(`Test saved successfully! ${generatedQuestions.length} questions saved.`)
      }
      
      // Redirect based on returnTo parameter or user role
      const urlParams = new URLSearchParams(window.location.search)
      const returnTo = urlParams.get('returnTo')
      
      // Add timestamp parameter to force data reload
      const addTimestamp = (url: string) => {
        return url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`
      }
      
      if (returnTo) {
        router.push(addTimestamp(returnTo))
      } else {
        // Fallback: redirect based on user role
        const userRole = session?.user?.role
        if (userRole === 'owner') {
          router.push(addTimestamp('/owner?tab=tests'))
        } else {
          router.push(addTimestamp('/manager?tab=tests'))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToSaveTest'))
    } finally {
      setIsSaving(false)
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 min-w-0">
              <Image
                src="/Uppstaff_logo.svg"
                alt="Logo"
                width={38}
                height={38}
                className="object-contain flex-shrink-0"
                priority
              />
              <h1 className="text-lg sm:text-xl font-semibold text-foreground dark:text-white truncate">
                {isEditMode ? t('editTest') : t('testBuilder')}
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
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6 overflow-hidden">
          {/* Configuration Panel */}
          <div className="space-y-3 md:space-y-6 min-w-0">
            {/* Test Configuration */}
            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle><span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">🧪</span> <span className="leading-none self-center">{t('testConfiguration')}</span></CardTitle>
                  <CardDescription>{t('configureTestParameters')}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 overflow-hidden">
                <FormField
                  label={t('selectDocument')}
                  required
                  error={touched.documentId ? errors.documentId : undefined}
                >
                  <Select 
                    value={values.documentId || ''} 
                    onValueChange={(value) => {
                      const doc = documents.find(d => String(d.id) === String(value))
                      if (doc) {
                        handleDocumentSelect(doc)
                      } else {
                        console.warn('Document not found in list for value:', value)
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('chooseDocumentToGenerate')} />
                    </SelectTrigger>
                    <SelectContent>
                      {documents.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">No documents available</div>
                      ) : (
                        documents.map((doc) => {
                          const docId = String(doc.id)
                          const isSelected = selectedDocument && String(selectedDocument.id) === docId
                          return (
                            <SelectItem key={docId} value={docId}>
                              <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4" />
                                <span>{doc.title || doc.originalFileName || 'Untitled Document'}</span>
                                {isSelected && <span className="text-blue-600">✓</span>}
                              </div>
                            </SelectItem>
                          )
                        })
                      )}
                    </SelectContent>
                  </Select>
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label={t('numberOfQuestions')}
                    required
                    error={touched.count ? errors.count : undefined}
                  >
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={testConfig.count ? String(testConfig.count) : ''}
                      onChange={(e) => {
                        const value = e.target.value
                        // Allow empty string for typing, or valid positive integers up to 20
                        if (value === '' || /^\d+$/.test(value)) {
                          if (value === '') {
                            // Allow empty while typing - validation will catch it
                            setValue('count', 0)
                          } else {
                            const numValue = parseInt(value, 10)
                            if (!isNaN(numValue) && numValue > 0 && numValue <= 20) {
                              setValue('count', numValue)
                            }
                          }
                        }
                      }}
                      onBlur={() => {
                        setFieldTouched('count')
                        // Ensure we have a valid number on blur
                        if (!testConfig.count || testConfig.count < 1) {
                          setValue('count', 5) // Default to 5 if invalid
                        } else if (testConfig.count > 20) {
                          setValue('count', 20) // Cap at 20 if over limit
                        }
                      }}
                      className="w-full"
                      placeholder={t('enterNumberOfQuestions')}
                    />
                  </FormField>
                  <FormField
                    label={t('questionType')}
                    required
                    error={touched.type ? errors.type : undefined}
                  >
                    <Select 
                      value={testConfig.type || 'mcq'} 
                      onValueChange={(value) => {
                        setValue('type', value)
                        setFieldTouched('type')
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {questionTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.value === 'mcq' ? t('multipleChoiceSingle') :
                             type.value === 'mcq_multi' ? t('multipleChoiceMultiple') :
                             type.value === 'tf' ? t('trueFalse') :
                             type.value === 'complete' ? t('fillInBlank') :
                             type.value === 'cloze' ? t('clozeTest') :
                             type.value === 'match' ? t('matching') :
                             type.value === 'order' ? t('ordering') :
                             type.value === 'mixed' ? t('mixedTypes') :
                             type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label={t('difficulty')}
                    required
                    error={touched.difficulty ? errors.difficulty : undefined}
                  >
                    <Select 
                      value={testConfig.difficulty || 'medium'} 
                      onValueChange={(value) => {
                        setValue('difficulty', value)
                        setFieldTouched('difficulty')
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {difficultyLevels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.value === 'easy' ? t('easy') :
                             level.value === 'medium' ? t('medium') :
                             level.value === 'hard' ? t('hard') :
                             level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField
                    label={t('language')}
                    required
                    error={touched.locale ? errors.locale : undefined}
                  >
                    <Select 
                      value={testConfig.locale || 'en'} 
                      onValueChange={(value) => {
                        setValue('locale', value)
                        setFieldTouched('locale')
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {locales.map((locale) => (
                          <SelectItem key={locale.value} value={locale.value}>
                            {locale.value === 'ru' ? t('russian') :
                             locale.value === 'en' ? t('english') :
                             locale.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>

                <div className="pt-4">
                  <Button 
                    onClick={handleGenerateTest}
                    disabled={isGenerating || !selectedDocument}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {generatedQuestions.length > 0 ? t('loading') + '...' : t('loading') + '...'}
                      </>
                    ) : (
                      <>
                        <TestTube className="h-4 w-4 mr-2" />
                        {t('addQuestion')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Results Panel */}
          <div className="space-y-3 md:space-y-6 min-w-0">
            <ErrorMessage error={error} />

            {generatedQuestions.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader>
                  <div className="flex flex-col gap-4">
                    <div className="min-w-0 flex-1">
                      <CardTitle><span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">❓</span> <span className="leading-none self-center">{t('generatedQuestions')}</span></CardTitle>
                      <CardDescription className="wrap-break-word">
                        {isEditMode ? (
                          <>
                            {generatedQuestions.length} {t('questions')} {t('total')} 
                            ({originalQuestionCount} {t('existing')}, {generatedQuestions.length - originalQuestionCount} {t('new')})
                          </>
                        ) : (
                          `${generatedQuestions.length} ${t('questionsGeneratedSuccessfully')}`
                        )}
                        {aiProvider && (
                          <span className="ml-2 text-blue-600">
                            (via {aiProvider === 'mock' ? 'Mock Data' : aiProvider.toUpperCase()})
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      {isEditMode && generatedQuestions.length > 0 && (
                        <Button 
                          onClick={handleClearAllQuestions}
                          variant="outline"
                          className="w-full sm:w-auto"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('clear')}
                        </Button>
                      )}
                      <Button 
                        onClick={handleSaveTest}
                        disabled={isSaving}
                        className="w-full sm:w-auto"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {t('loading')}...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            {isEditMode ? t('save') : t('saveTest')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-hidden">
                  <div className="space-y-4">
                    {generatedQuestions.map((question, index) => (
                      <div key={question.id || index} className="p-4 border rounded-3xl overflow-hidden">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <h4 className="font-medium truncate">{t('question')} {index + 1}</h4>
                            {isEditMode && index >= originalQuestionCount && (
                              <Badge variant="default" className="text-xs shrink-0">{t('new')}</Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <TestTypeBadge type={question.type} />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteQuestion(question.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <Label>{t('questionText')}</Label>
                            <Textarea
                              value={question.prompt}
                              onChange={(e) => handleUpdateQuestionField(question.id, 'prompt', e.target.value)}
                              className="w-full"
                              rows={3}
                            />
                          </div>
                          
                          {question.choices && question.choices.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <Label>{t('answerChoices')}</Label>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddChoice(question.id)}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  {t('addChoice')}
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {question.choices.map((choice: string, choiceIndex: number) => (
                                  <div key={choiceIndex} className="flex items-center space-x-2 min-w-0">
                                    <span className="text-sm font-medium w-6 shrink-0">
                                      {String.fromCharCode(65 + choiceIndex)}.
                                    </span>
                                    <Input
                                      value={choice}
                                      onChange={(e) => handleUpdateChoice(question.id, choiceIndex, e.target.value)}
                                      className="flex-1 min-w-0"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteChoice(question.id, choiceIndex)}
                                      className="shrink-0"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div>
                            <Label>{t('correctAnswer')}</Label>
                            <Input
                              value={question.correct_answer || ''}
                              onChange={(e) => handleUpdateQuestionField(question.id, 'correct_answer', e.target.value)}
                              placeholder={t('correctAnswerPlaceholder')}
                              className="w-full"
                            />
                          </div>
                          
                          <div>
                            <Label>{t('explanation')}</Label>
                            <Textarea
                              value={question.explanation || ''}
                              onChange={(e) => handleUpdateQuestionField(question.id, 'explanation', e.target.value)}
                              className="w-full"
                              rows={2}
                              placeholder={t('explanationPlaceholder')}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
