"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

// Mock documents data - in real app this would come from your docs API
const mockDocuments: Document[] = [
  { id: 1, name: "Ланч меню BS.docx", type: "DOCX", uploadedAt: "2 hours ago" },
  { id: 2, name: "Training Schedule.xlsx", type: "XLSX", uploadedAt: "1 day ago" },
  { id: 3, name: "Employee Handbook.docx", type: "DOCX", uploadedAt: "5 minutes ago" },
  { id: 4, name: "Safety Guidelines.pdf", type: "PDF", uploadedAt: "1 hour ago" }
]

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
  const router = useRouter()
  
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

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }
  }, [session, status, router])

  const handleDocumentSelect = (doc: Document) => {
    setSelectedDocument(doc)
    // Load actual document content based on document name
    const documentContent = getDocumentContent(doc.name)
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
        sourceRefs: [selectedDocument.name]
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
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.ok) {
        setGeneratedQuestions(result.questions || [])
        setAiProvider(result.provider || 'unknown')
      } else {
        throw new Error(result.error || 'Failed to generate questions')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate test')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClose = () => {
    router.push('/manager?tab=tests')
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
      // Create test data structure
      const testData = {
        id: Date.now().toString(), // Simple ID generation
        title: `${selectedDocument.name} - Test`,
        type: testConfig.type,
        difficulty: testConfig.difficulty,
        locale: testConfig.locale,
        questionCount: generatedQuestions.length,
        questions: generatedQuestions,
        sourceDocument: selectedDocument.name,
        createdAt: new Date().toISOString(),
        createdBy: session?.user?.name || 'Unknown'
      }

      // In a real app, you would save this to your database
      // For now, we'll save to localStorage as a demo
      const existingTests = JSON.parse(localStorage.getItem('savedTests') || '[]')
      existingTests.push(testData)
      localStorage.setItem('savedTests', JSON.stringify(existingTests))

      // Show success message
      alert(`Test saved successfully! ${generatedQuestions.length} questions saved.`)
      
      // Optionally redirect to tests list
      router.push('/manager?tab=tests')
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
              <TestTube className="h-8 w-8 text-blue-600 mr-3 shrink-0" />
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                Test Builder
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Panel */}
          <div className="space-y-6">
            {/* Test Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Test Configuration</CardTitle>
                <CardDescription>Configure your test parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="document-select">Select Document</Label>
                  <Select 
                    value={selectedDocument?.id?.toString() || ""} 
                    onValueChange={(value) => {
                      const doc = mockDocuments.find(d => d.id.toString() === value)
                      if (doc) handleDocumentSelect(doc)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a document to generate questions from..." />
                    </SelectTrigger>
                    <SelectContent>
                      {mockDocuments.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id.toString()}>
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4" />
                            <span>{doc.name}</span>
                            <Badge variant="outline" className="ml-2">{doc.type}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="count">Number of Questions</Label>
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
                    <Label htmlFor="type">Question Type</Label>
                    <Select value={testConfig.type} onValueChange={(value) => setTestConfig(prev => ({ ...prev, type: value }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {questionTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="difficulty">Difficulty</Label>
                    <Select value={testConfig.difficulty} onValueChange={(value) => setTestConfig(prev => ({ ...prev, difficulty: value }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {difficultyLevels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="locale">Language</Label>
                    <Select value={testConfig.locale} onValueChange={(value) => setTestConfig(prev => ({ ...prev, locale: value }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {locales.map((locale) => (
                          <SelectItem key={locale.value} value={locale.value}>
                            {locale.label}
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
                        Generating...
                      </>
                    ) : (
                      <>
                        <TestTube className="h-4 w-4 mr-2" />
                        Generate Test
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Results Panel */}
          <div className="space-y-6">
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <p className="text-red-600">{error}</p>
                </CardContent>
              </Card>
            )}

            {generatedQuestions.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                      <CardTitle>Generated Questions</CardTitle>
                      <CardDescription>
                        {generatedQuestions.length} questions generated successfully
                        {aiProvider && (
                          <span className="ml-2 text-blue-600">
                            (via {aiProvider === 'mock' ? 'Mock Data' : aiProvider.toUpperCase()})
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={handleSaveTest}
                      disabled={isSaving}
                      className="w-full sm:w-auto"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Test
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {generatedQuestions.map((question, index) => (
                      <div key={question.id || index} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium">Question {index + 1}</h4>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{question.type}</Badge>
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
                            <Label>Question Text</Label>
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
                                <Label>Answer Choices</Label>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddChoice(question.id)}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Choice
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {question.choices.map((choice: string, choiceIndex: number) => (
                                  <div key={choiceIndex} className="flex items-center space-x-2">
                                    <span className="text-sm font-medium w-6">
                                      {String.fromCharCode(65 + choiceIndex)}.
                                    </span>
                                    <Input
                                      value={choice}
                                      onChange={(e) => handleUpdateChoice(question.id, choiceIndex, e.target.value)}
                                      className="flex-1"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteChoice(question.id, choiceIndex)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div>
                            <Label>Correct Answer</Label>
                            <Input
                              value={question.correct_answer || ''}
                              onChange={(e) => handleUpdateQuestionField(question.id, 'correct_answer', e.target.value)}
                              placeholder="e.g., A, B, C, or D"
                              className="w-full"
                            />
                          </div>
                          
                          <div>
                            <Label>Explanation</Label>
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
