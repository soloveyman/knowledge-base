"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
  AlertCircle
} from "lucide-react"
import { useParams } from "next/navigation"

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

  const [testData, setTestData] = useState<TestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showResults, setShowResults] = useState(false)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15 minutes in seconds
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Load test data from localStorage
    if (typeof window !== 'undefined') {
      const savedTests = JSON.parse(localStorage.getItem('savedTests') || '[]')
      const test = savedTests.find((t: any) => t.id === testId)
      
      if (test) {
        setTestData(test)
      }
      
      setLoading(false)
    }
  }, [session, status, router, testId])

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
  }, [showResults, testData])

  const handleAnswerSelect = (questionId: string, answer: string) => {
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

  const handleSubmitTest = () => {
    if (!testData) return

    let correctAnswers = 0
    testData.questions.forEach(question => {
      if (answers[question.id] === question.correct_answer) {
        correctAnswers++
      }
    })

    const percentage = Math.round((correctAnswers / testData.questions.length) * 100)
    setScore(percentage)
    setShowResults(true)

    // Update assignment status based on test score
    const savedAssignments = JSON.parse(localStorage.getItem('savedAssignments') || '[]')
    const updatedAssignments = savedAssignments.map((assignment: any) => {
      if (assignment.test?.id === testId) {
        return { 
          ...assignment, 
          status: percentage >= 70 ? 'completed' : 'failed',
          testScore: percentage
        }
      }
      return assignment
    })
    localStorage.setItem('savedAssignments', JSON.stringify(updatedAssignments))
  }

  const handleBack = () => {
    // Check if user has answered any questions
    const hasAnswers = Object.keys(answers).length > 0
    
    if (hasAnswers && !showResults) {
      setShowExitConfirm(true)
    } else {
      router.push('/employee?tab=assignments')
    }
  }

  const handleConfirmExit = () => {
    setShowExitConfirm(false)
    router.push('/employee?tab=assignments')
  }

  const handleCancelExit = () => {
    setShowExitConfirm(false)
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
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

  if (!testData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <TestTube className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Test Not Found</h2>
          <p className="text-gray-600 mb-4">The requested test could not be found.</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assignments
          </Button>
        </div>
      </div>
    )
  }

  if (showResults) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center min-w-0">
                <TestTube className="h-8 w-8 text-blue-600 mr-3 shrink-0" />
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
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
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                {score >= 70 ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-red-600" />
                )}
              </div>
              <CardTitle className="text-2xl">
                {score >= 70 ? 'Congratulations!' : 'Test Completed'}
              </CardTitle>
              <CardDescription>
                {testData.title}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="text-6xl font-bold text-blue-600">
                {score}%
              </div>
              <div className="text-lg text-gray-600">
                {score >= 70 ? 'You passed the test!' : 'You need to score 70% or higher to pass.'}
              </div>
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {Object.keys(answers).length}
                  </div>
                  <div className="text-sm text-gray-600">Questions Answered</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {testData.questions.length}
                  </div>
                  <div className="text-sm text-gray-600">Total Questions</div>
                </div>
              </div>
              <Button onClick={handleBack} className="w-full max-w-xs">
                Back to Assignments
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
              <TestTube className="h-8 w-8 text-blue-600 mr-3 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                  {testData.title}
                </h1>
                <p className="text-sm text-gray-600">
                  Question {currentQuestion + 1} of {testData.questions.length}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
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
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Question {currentQuestion + 1}
            </CardTitle>
            <CardDescription>
              {testData.difficulty.charAt(0).toUpperCase() + testData.difficulty.slice(1)} • {testData.type.toUpperCase()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-lg font-medium">
              {currentQ.prompt}
            </div>

            {currentQ.choices && (
              <div className="space-y-3">
                {currentQ.choices.map((choice, index) => {
                  const letter = String.fromCharCode(65 + index)
                  const isSelected = answers[currentQ.id] === letter
                  
                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(currentQ.id, letter)}
                      className={`w-full p-4 text-left border rounded-lg transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-gray-300'
                        }`}>
                          {letter}
                        </div>
                        <span>{choice}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={handlePreviousQuestion}
                disabled={currentQuestion === 0}
              >
                Previous
              </Button>
              
              <div className="flex space-x-2">
                {currentQuestion === testData.questions.length - 1 ? (
                  <Button onClick={handleSubmitTest} className="bg-green-600 hover:bg-green-700">
                    Submit Test
                  </Button>
                ) : (
                  <Button onClick={handleNextQuestion}>
                    Next
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
              Continue Test
            </Button>
            <Button variant="destructive" onClick={handleConfirmExit}>
              Exit Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
