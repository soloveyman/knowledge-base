"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  FileText, 
  X,
  BookOpen,
  TestTube
} from "lucide-react"
import { useParams } from "next/navigation"

interface DocumentData {
  id: string
  name: string
  type: string
  uploadedAt: string
  uploadedBy: string
  size: string
  content: string
}

interface AssignmentData {
  id: string
  name: string
  description: string
  document: DocumentData
  test: {
    id: string
    title: string
    questionCount: number
  } | null
  dueDate: string
  status: string
}

export default function DocumentReaderPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const documentId = params.documentId as string

  const [documentData, setDocumentData] = useState<DocumentData | null>(null)
  const [assignmentData, setAssignmentData] = useState<AssignmentData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Load assignment data from localStorage
    if (typeof window !== 'undefined') {
      const savedAssignments = JSON.parse(localStorage.getItem('savedAssignments') || '[]')
      const assignment = savedAssignments.find((a: any) => a.document?.id.toString() === documentId)
      
      if (assignment) {
        setAssignmentData(assignment)
        
        // Create document data with content
        const documentWithContent = {
          ...assignment.document,
          uploadedBy: assignment.createdBy,
          size: '2.5 MB',
          content: getDocumentContent(assignment.document.name)
        }
        setDocumentData(documentWithContent)
        
        // Update assignment status to in_progress when user starts reading
        if (assignment.status === 'pending' || assignment.status === 'active') {
          const updatedAssignments = savedAssignments.map((a: any) => 
            a.id === assignment.id 
              ? { ...a, status: 'in_progress' }
              : a
          )
          localStorage.setItem('savedAssignments', JSON.stringify(updatedAssignments))
          setAssignmentData(prev => prev ? { ...prev, status: 'in_progress' } : null)
        }
      }
      
      setLoading(false)
    }
  }, [session, status, router, documentId])

  // Mock document content - same as test builder
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

  const handleTakeTest = () => {
    if (assignmentData?.test) {
      router.push(`/test/${assignmentData.test.id}`)
    }
  }

  const handleBack = () => {
    router.push('/employee?tab=assignments')
  }


  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  if (!documentData || !assignmentData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Document Not Found</h2>
          <p className="text-gray-600 mb-4">The requested document could not be found.</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assignments
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
              <BookOpen className="h-8 w-8 text-blue-600 mr-3 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                  {assignmentData.name}
                </h1>
                <p className="text-sm text-gray-600 truncate">
                  {documentData.name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>


      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Document Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {documentData.name}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {assignmentData.description}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {documentData.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  {documentData.type === 'PDF' ? (
                    <div className="w-full h-screen border border-gray-200 rounded-lg overflow-hidden">
                      <iframe 
                        src={`/api/documents/${encodeURIComponent(documentData.name)}`}
                        className="w-full h-full"
                        title={documentData.name}
                      />
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                      {documentData.content}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Test Section */}
              {assignmentData.test && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TestTube className="h-5 w-5" />
                      Test Available
                    </CardTitle>
                    <CardDescription>
                      Complete the test after reading the document
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-gray-600">
                      <p><strong>Test:</strong> {assignmentData.test.title}</p>
                      <p><strong>Questions:</strong> {assignmentData.test.questionCount}</p>
                      <p><strong>Estimated time:</strong> 15 minutes</p>
                    </div>
                    
                    <Button 
                      onClick={handleTakeTest}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={assignmentData.status === 'completed'}
                    >
                      <TestTube className="h-4 w-4 mr-2" />
                      {assignmentData.status === 'completed' ? 'Test Completed' : 'Take Test'}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
