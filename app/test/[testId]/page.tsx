"use client"

import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { useEffect, useState, useCallback, useLayoutEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  TestTube, 
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from "lucide-react"
import { useNavigateBack } from "@/lib/redirect-utils"
import { useTranslation } from "@/lib/translation-context"
import { renderFormattedText } from "@/lib/content-renderer"

interface UserWithRole {
  name?: string | null
  email?: string | null
  role?: string
}

interface TestQuestion {
  id: string
  type: string
  prompt: string
  choices?: string[]
  correct_answer?: string
  explanation?: string
}

interface TestData {
  id: string
  title: string
  type: string
  difficulty: string
  locale: string
  questionCount: number
  questions: TestQuestion[]
  sourceDocument: string
  createdAt: string
  createdBy: string
}

export default function TestPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const testId = params.testId as string
  const navigateBack = useNavigateBack()
  const { t } = useTranslation()

  const [testData, setTestData] = useState<TestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showResults, setShowResults] = useState(false)
  const [score, setScore] = useState(0)
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15 minutes in seconds
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Load test data from API
    const loadTestData = async () => {
      try {
        // Use cache: 'no-store' to always get fresh data, including updated answers
        const response = await fetch(`/api/tests/${testId}`, { cache: 'no-store' })
        const result = await response.json()
        
        if (result.success && result.data.test) {
          const test = result.data.test
          const questionsFromApi = result.data.questions || []
          
          // Transform database questions to TestQuestion format
          const transformedQuestions: TestQuestion[] = questionsFromApi.map((q: {
            id: string
            type?: string
            content?: string
            title?: string
            options?: string[] | null
            correctAnswer?: string | null
            explanation?: string | null
          }) => {
            // Convert database type to frontend type
            let questionType = 'mcq'
            if (q.type === 'multiple_choice') questionType = 'mcq'
            else if (q.type === 'true_false') questionType = 'tf'
            else if (q.type === 'text') questionType = 'complete'
            
            // Log loaded correct answers to verify updates are being loaded
            console.log(`Loaded question ${q.id}: correctAnswer = "${q.correctAnswer}"`)
            
            return {
              id: q.id,
              type: questionType,
              prompt: q.content || q.title || 'Question',
              choices: Array.isArray(q.options) ? q.options : [],
              correct_answer: q.correctAnswer || undefined,
              explanation: q.explanation || undefined
            }
          })
          
          setTestData({
            id: test.id,
            title: test.title,
            type: test.type || 'mcq',
            difficulty: test.difficulty || 'medium',
            locale: 'ru', // Default locale
            questionCount: transformedQuestions.length,
            questions: transformedQuestions,
            sourceDocument: test.moduleId || 'Unknown',
            createdAt: test.createdAt,
            createdBy: test.createdBy || 'Unknown'
          })
        }
      } catch (error) {
        console.error('Error loading test:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTestData()
  }, [session, status, router, testId])

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const handleTextAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const handleNextQuestion = () => {
    if (testData && currentQuestion < testData.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1)
    }
  }

  const handleSubmitTest = useCallback(async () => {
    if (!testData) return

    let correctAnswers = 0
    testData.questions.forEach(question => {
      const userAnswer = answers[question.id]
      
      // Skip if question has no correct answer defined
      if (!question.correct_answer) return
      
      // If user didn't answer, it's incorrect (don't increment correctAnswers)
      if (!userAnswer) return
      
      // Handle text/complete questions differently
      if (question.type === 'complete' || question.type === 'text') {
        // For text questions, compare answers case-insensitively after trimming
        const normalizedUserAnswer = userAnswer.trim().toLowerCase()
        const normalizedCorrectAnswer = question.correct_answer.trim().toLowerCase()
        
        if (normalizedUserAnswer === normalizedCorrectAnswer) {
          correctAnswers++
        }
      } 
      // Handle multiple choice and true/false questions
      else {
        // Normalize correct answer to letter format (A, B, C, D) or true/false
        let correctAnswerLetter: string | null = null
        
        // If correct_answer is already a letter (A, B, C, D)
        if (/^[A-Z]$/.test(question.correct_answer)) {
          correctAnswerLetter = question.correct_answer.toUpperCase()
        } 
        // If correct_answer is a numeric index (0, 1, 2, 3)
        else if (/^\d+$/.test(question.correct_answer)) {
          const index = parseInt(question.correct_answer, 10)
          if (question.choices && index >= 0 && index < question.choices.length) {
            correctAnswerLetter = String.fromCharCode(65 + index)
          }
        }
        // If correct_answer matches one of the choice texts, find its index
        else if (question.choices && question.correct_answer) {
          const correctAnswerText = question.correct_answer
          const choiceIndex = question.choices.findIndex(
            choice => choice.trim().toLowerCase() === correctAnswerText.trim().toLowerCase()
          )
          if (choiceIndex >= 0) {
            correctAnswerLetter = String.fromCharCode(65 + choiceIndex)
          }
        }
        // Handle true/false questions
        else if (question.type === 'tf') {
          // Normalize true/false values
          const normalizedCorrect = question.correct_answer.trim().toLowerCase()
          if (normalizedCorrect === 'true' || normalizedCorrect === 'false') {
            correctAnswerLetter = normalizedCorrect
          }
        }
        
        // Compare normalized answers
        if (correctAnswerLetter && userAnswer.toLowerCase() === correctAnswerLetter.toLowerCase()) {
          correctAnswers++
        }
      }
    })

    const percentage = testData.questions.length > 0 
      ? Math.round((correctAnswers / testData.questions.length) * 100)
      : 0
    setScore(percentage)
    setCorrectAnswersCount(correctAnswers)
    setShowResults(true)

    // Save test attempt to database
    try {
      const response = await fetch('/api/test-attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          testId: testId,
          answers: answers,
          score: percentage,
          timeSpent: (15 * 60) - timeLeft, // Calculate time spent
          status: 'completed'
        })
      })

      if (!response.ok) {
        console.error('Failed to save test attempt')
      } else {
        // Trigger assignments refresh for employee when returning to page
        if (typeof window !== 'undefined') {
          // Set a flag to refresh assignments when employee returns to their page
          sessionStorage.setItem('pendingAssignmentsRefresh', JSON.stringify({
            timestamp: Date.now(),
            trigger: 'test_completed'
          }))
        }
      }
    } catch (error) {
      console.error('Error saving test attempt:', error)
    }
  }, [testData, answers, testId, timeLeft])

  // Timer effect
  useEffect(() => {
    if (showResults || !testData) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmitTest()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [showResults, testData, handleSubmitTest])

  const handleBack = () => {
    // Check if user has answered any questions
    const hasAnswers = Object.keys(answers).length > 0
    
    if (hasAnswers && !showResults) {
      setShowExitConfirm(true)
    } else {
      // Determine user role from session or default to employee
      const userRole = (session?.user as UserWithRole)?.role || 'employee'
      navigateBack(userRole as 'employee' | 'manager' | 'owner', 'assignments')
    }
  }

  const handleConfirmExit = () => {
    setShowExitConfirm(false)
    // Determine user role from session or default to employee
    const userRole = (session?.user as UserWithRole)?.role || 'employee'
    navigateBack(userRole as 'employee' | 'manager' | 'owner', 'assignments')
  }

  const handleCancelExit = () => {
    setShowExitConfirm(false)
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Don't block UI while session loads - show page immediately
  if (status === "loading") {
    // Show page but with disabled state - don't block with spinner
  }

  if (!session) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background animate-in fade-in-0 duration-200">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading test...</p>
        </div>
      </div>
    )
  }

  if (!testData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <TestTube className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground dark:text-white mb-2">{t('testNotFoundTitle')}</h2>
          <p className="text-muted-foreground mb-4">{t('testNotFound')}</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToAssignments')}
          </Button>
        </div>
      </div>
    )
  }

  if (showResults) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-50">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground dark:text-white truncate">
                  Test Results
                </h1>
              </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            </div>
          </div>
        </header>

        {/* Results */}
        <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-6 pb-4 md:py-8">
          <Card className="w-full max-w-4xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-center justify-center">
                {score >= 70 ? t('congratulations') : t('testCompleted')}
              </CardTitle>
              <CardDescription>
                {testData.title}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className={`text-6xl font-bold ${score >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                {score}%
              </div>
              <div className="text-lg text-muted-foreground">
                {score >= 70 ? t('youPassedTheTest') : t('youNeedToScore70PercentOrHigherToPass')}
              </div>
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div className="bg-muted p-4 rounded-3xl">
                  <div className="text-2xl font-bold text-foreground">
                    {correctAnswersCount}
                  </div>
                  <div className="text-sm text-muted-foreground">{t('correctAnswers')}</div>
                </div>
                <div className="bg-muted p-4 rounded-3xl">
                  <div className="text-2xl font-bold text-foreground">
                    {testData.questions.length}
                  </div>
                  <div className="text-sm text-muted-foreground">{t('totalQuestions')}</div>
                </div>
              </div>
              <Button onClick={handleBack} className="w-full max-w-xs">
                {t('backToAssignments')}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const currentQ = testData.questions[currentQuestion]
  const progress = ((currentQuestion + 1) / testData.questions.length) * 100

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground dark:text-white truncate">
                  {testData.title}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t('question')} {currentQuestion + 1} {t('of')} {testData.questions.length}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{formatTime(timeLeft)}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-card border-b">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>{t('progress')}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 md:py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              {t('question')} {currentQuestion + 1}
            </CardTitle>
            <CardDescription>
              {testData.difficulty.charAt(0).toUpperCase() + testData.difficulty.slice(1)} • {testData.type.toUpperCase() === 'MCQ' ? t('mcq') : testData.type.toUpperCase()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div 
              className="text-lg font-medium prose max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: renderFormattedText(currentQ.prompt || '') 
              }}
            />

            {/* Multiple choice questions */}
            {currentQ.type === 'mcq' && currentQ.choices && currentQ.choices.length > 0 && (
              <div className="space-y-3">
                {currentQ.choices.map((choice, index) => {
                  const letter = String.fromCharCode(65 + index)
                  const isSelected = answers[currentQ.id] === letter
                  
                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(currentQ.id, letter)}
                      className={`w-full p-4 text-left border rounded-3xl transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary-700 dark:text-primary-300'
                          : 'border-border hover:border-accent hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-medium shrink-0 ${
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border'
                        }`}>
                          {letter}
                        </div>
                        <span className="flex-1 break-word leading-relaxed">{choice}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* True/False questions */}
            {currentQ.type === 'tf' && (
              <div className="space-y-3">
                {[t('true'), t('false')].map((option, index) => {
                  const value = index === 0 ? 'true' : 'false'
                  const isSelected = answers[currentQ.id] === value
                  
                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(currentQ.id, value)}
                      className={`w-full p-4 text-left border rounded-3xl transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary-700 dark:text-primary-300'
                          : 'border-border hover:border-accent hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-medium shrink-0 ${
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border'
                        }`}>
                          {index === 0 ? 'T' : 'F'}
                        </div>
                        <span className="flex-1 break-word leading-relaxed">{option}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Text input questions (complete/fill in the blank) */}
            {(currentQ.type === 'complete' || currentQ.type === 'text') && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('yourAnswer') || 'Your Answer'}
                </label>
                <Textarea
                  value={answers[currentQ.id] || ''}
                  onChange={(e) => handleTextAnswerChange(currentQ.id, e.target.value)}
                  placeholder={t('enterYourAnswer') || 'Enter your answer here...'}
                  className="min-h-[120px] resize-none"
                />
              </div>
            )}

            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={handlePreviousQuestion}
                disabled={currentQuestion === 0}
              >
                {t('previous')}
              </Button>
              
              <div className="flex space-x-2">
                {currentQuestion === testData.questions.length - 1 ? (
                  <Button onClick={handleSubmitTest} className="bg-green-600 hover:bg-green-700">
                    {t('submitTest')}
                  </Button>
                ) : (
                  <Button onClick={handleNextQuestion}>
                    {t('next')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Exit Confirmation Dialog */}
      <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exit Test?</DialogTitle>
            <DialogDescription>
              You have answered {Object.keys(answers).length} question(s). Your progress will not be saved if you exit now. Are you sure you want to leave?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelExit}>
              {t('continueTest')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmExit}>
              {t('exitTest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
