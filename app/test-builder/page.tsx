"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TestTypeBadge } from "@/lib/badges"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ErrorMessage } from "@/components/common/error-message"
import { useTranslation } from "@/lib/translation-context"
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
  const [testConfig, setTestConfig] = useState<TestConfig>({
    count: 5,
    type: "mcq",
    difficulty: "medium",
    locale: "ru"
  })
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

  // Load documents from API
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await fetch('/api/documents')
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
        
        // Load test configuration
        setTestConfig({
          count: test.questionIds?.length || 5,
          type: questions.length > 0 ? questions[0].type || 'mcq' : 'mcq',
          difficulty: questions.length > 0 ? questions[0].difficulty || 'medium' : 'medium',
          locale: 'ru' // Default locale
        })

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
              setDocuments(prevDocs => {
                console.log('Test Builder: Current documents list length:', prevDocs.length)
                const existingDoc = prevDocs.find(d => String(d.id) === String(documentToSet.id))
                if (!existingDoc) {
                  // Add document to list if not present
                  console.log('Test Builder: Adding document to documents list:', documentToSet.id)
                  const newList = [...prevDocs, documentToSet]
                  console.log('Test Builder: New documents list length:', newList.length)
                  return newList
                } else {
                  console.log('Test Builder: Document already in list:', documentToSet.id)
                }
                return prevDocs
              })
              
              // Use requestAnimationFrame to ensure state updates are processed
              requestAnimationFrame(() => {
                console.log('Test Builder: Setting selectedDocument via requestAnimationFrame to:', documentToSet.id)
                setSelectedDocument(documentToSet)
                
                // Double-check after a brief delay
                setTimeout(() => {
                  console.log('Test Builder: Verifying selectedDocument after delay')
                }, 200)
              })
              
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
              
              // Fallback to mock content if no parsed content
              if (!documentContent) {
                documentContent = getDocumentContent(document.title)
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
                setSelectedDocument({
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
                })
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
      setError('Failed to load test for editing')
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
      
      // Wait for documents to load before loading test (ensures document can be selected)
      if (documents.length === 0) {
        console.log('Test Builder: Waiting for documents to load...')
        // Wait a bit for documents to load, then load test
        const timer = setTimeout(() => {
          console.log('Test Builder: Documents should be loaded now, loading test...')
          loadTestForEditing(editingId).then(() => {
            setTestLoaded(true)
          })
        }, 1000) // Increased timeout to ensure documents are loaded
        return () => clearTimeout(timer)
      } else {
        console.log('Test Builder: Documents already loaded, loading test immediately...')
        loadTestForEditing(editingId).then(() => {
          setTestLoaded(true)
        })
      }
    }
  }, [session, status, router, loadTestForEditing, documents.length, testLoaded])

  const handleDocumentSelect = (doc: Document) => {
    setSelectedDocument(doc)
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
    
    // Fallback to mock content if no parsed content
    if (!documentContent) {
      documentContent = getDocumentContent(doc.title || doc.originalFileName || 'Untitled Document')
    }
    
    setContext(prev => ({
      ...prev,
      text: documentContent,
      facts: extractFacts(documentContent),
      steps: extractSteps(documentContent),
      definitions: extractDefinitions(documentContent)
    }))
  }

  // Mock document content - in real app this would come from your document storage
  const getDocumentContent = (docName: string) => {
    const mockContent = {
      "Ланч меню BS.docx": `Ланч меню BS

Основные блюда:
- Борщ украинский с мясом - 250₽
- Солянка мясная - 280₽
- Суп-пюре из тыквы - 220₽

Горячие блюда:
- Котлета по-киевски с картофельным пюре - 450₽
- Рыба запеченная с овощами - 380₽
- Плов узбекский - 320₽

Салаты:
- Цезарь с курицей - 180₽
- Греческий салат - 160₽
- Винегрет - 120₽

Напитки:
- Компот из сухофруктов - 80₽
- Морс клюквенный - 90₽
- Чай/кофе - 60₽`,

      "Training Schedule.xlsx": `Расписание обучения персонала

Понедельник:
- 9:00-10:30 - Обучение новичков (основы работы)
- 14:00-15:30 - Курс по технике безопасности

Вторник:
- 10:00-11:30 - Обучение работе с кассой
- 15:00-16:30 - Курс по обслуживанию клиентов

Среда:
- 9:30-11:00 - Обучение приготовлению блюд
- 14:30-16:00 - Курс по санитарным нормам

Четверг:
- 10:30-12:00 - Обучение работе с меню
- 15:30-17:00 - Курс по работе в команде

Пятница:
- 9:00-10:30 - Повторение пройденного материала
- 14:00-15:30 - Тестирование знаний`,

      "Employee Handbook.docx": `Справочник сотрудника

1. Общие положения
- Рабочий день: 8:00-17:00
- Обеденный перерыв: 12:00-13:00
- Дресс-код: деловой стиль, чистая форма

2. Обязанности сотрудников
- Соблюдение трудовой дисциплины
- Выполнение поручений руководства
- Соблюдение техники безопасности
- Поддержание чистоты рабочего места

3. Права сотрудников
- Право на своевременную оплату труда
- Право на ежегодный отпуск
- Право на безопасные условия труда
- Право на профессиональное развитие

4. Дисциплинарные меры
- Замечание
- Выговор
- Увольнение`,

      "Safety Guidelines.pdf": `Руководство по технике безопасности

1. Общие требования безопасности
- Все сотрудники должны пройти инструктаж по технике безопасности
- Запрещается работать в состоянии алкогольного или наркотического опьянения
- Обязательно использование средств индивидуальной защиты

2. Безопасность на кухне
- Осторожно обращаться с ножами и режущими предметами
- Использовать прихватки при работе с горячими поверхностями
- Следить за чистотой полов для предотвращения падений

3. Безопасность при работе с оборудованием
- Не использовать неисправное оборудование
- Отключать электроприборы после работы
- Соблюдать инструкции по эксплуатации

4. Действия в чрезвычайных ситуациях
- При пожаре: вызвать пожарную службу, эвакуировать людей
- При травме: оказать первую помощь, вызвать скорую
- При аварии: сообщить руководству, зафиксировать происшествие`
    }
    
    return mockContent[docName as keyof typeof mockContent] || `Содержимое документа ${docName} не найдено.`
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
    if (!selectedDocument) {
      setError("Please select a document first")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const requestData = {
        params: testConfig,
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

      const result = await response.json()

      if (!response.ok || !result.success) {
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
    if (returnTo) {
      router.push(returnTo)
    } else {
      // Fallback: redirect based on user role
      const userRole = session?.user?.role
      if (userRole === 'owner') {
        router.push('/owner?tab=tests')
      } else {
        router.push('/manager?tab=tests')
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
              choices: [...(q.choices || []), "New choice"]
            } 
          : q
      )
    )
  }

  const handleClearAllQuestions = () => {
    if (confirm('Are you sure you want to clear all questions? This action cannot be undone.')) {
      setGeneratedQuestions([])
    }
  }

  const handleSaveTest = async () => {
    if (generatedQuestions.length === 0) {
      setError("No questions to save")
      return
    }

    if (!selectedDocument) {
      setError("Please select a document")
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

        alert(`Test updated successfully! ${generatedQuestions.length} questions updated.`)
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
            passingScore: 70,
            timeLimit: 15,
            maxAttempts: 1,
            shuffleQuestions: false,
            showCorrectAnswers: true,
            status: 'published'
          })
        })

        if (!response.ok) {
          throw new Error('Failed to create test')
        }

        alert(`Test saved successfully! ${generatedQuestions.length} questions saved.`)
      }
      
      // Redirect based on returnTo parameter or user role
      const urlParams = new URLSearchParams(window.location.search)
      const returnTo = urlParams.get('returnTo')
      if (returnTo) {
        router.push(returnTo)
      } else {
        // Fallback: redirect based on user role
        const userRole = session?.user?.role
        if (userRole === 'owner') {
          router.push('/owner?tab=tests')
        } else {
          router.push('/manager?tab=tests')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save test')
    } finally {
      setIsSaving(false)
    }
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 overflow-hidden">
          {/* Configuration Panel */}
          <div className="space-y-3 md:space-y-6 min-w-0">
            {/* Test Configuration */}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>{t('testConfiguration')}</CardTitle>
                <CardDescription>{t('configureTestParameters')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 overflow-hidden">
                <div>
                  <Label htmlFor="document-select">{t('selectDocument')} *</Label>
                  {(() => {
                    const selectValue = selectedDocument?.id ? String(selectedDocument.id) : ""
                    const docInList = documents.find(d => String(d.id) === selectValue)
                    console.log('Select render - selectedDocument ID:', selectedDocument?.id, 'selectValue:', selectValue, 'docInList:', !!docInList, 'documents count:', documents.length)
                    return null
                  })()}
                  <Select 
                    value={selectedDocument?.id ? String(selectedDocument.id) : ""} 
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="count">{t('numberOfQuestions')}</Label>
                    <Input
                      id="count"
                      type="number"
                      min="1"
                      max="50"
                      value={testConfig.count}
                      onChange={(e) => setTestConfig(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">{t('questionType')}</Label>
                    <Select value={testConfig.type} onValueChange={(value) => setTestConfig(prev => ({ ...prev, type: value }))}>
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
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="difficulty">{t('difficulty')}</Label>
                    <Select value={testConfig.difficulty} onValueChange={(value) => setTestConfig(prev => ({ ...prev, difficulty: value }))}>
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
                  </div>
                  <div>
                    <Label htmlFor="locale">{t('language')}</Label>
                    <Select value={testConfig.locale} onValueChange={(value) => setTestConfig(prev => ({ ...prev, locale: value }))}>
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
                  </div>
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
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <CardTitle>{t('generatedQuestions')}</CardTitle>
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
                      <div key={question.id || index} className="p-4 border rounded-lg overflow-hidden">
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
                              placeholder="e.g., A, B, C, or D"
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
                              placeholder="Explanation for the correct answer..."
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
