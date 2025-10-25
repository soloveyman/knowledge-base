"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  FileText, 
  X,
  TestTube,
  Loader2
} from "lucide-react"

// Mock documents data - in real app this would come from your docs API
const mockDocuments = [
  { id: 1, name: "Ланч меню BS.docx", type: "DOCX", uploadedAt: "2 hours ago" },
  { id: 2, name: "Training Schedule.xlsx", type: "XLSX", uploadedAt: "1 day ago" },
  { id: 3, name: "Employee Handbook.docx", type: "DOCX", uploadedAt: "5 minutes ago" },
  { id: 4, name: "Safety Guidelines.pdf", type: "PDF", uploadedAt: "1 hour ago" }
]

const questionTypes = [
  { value: "mcq", label: "Multiple Choice (Single)" },
  { value: "mcq_multi", label: "Multiple Choice (Multiple)" },
  { value: "tf", label: "True/False" },
  { value: "complete", label: "Fill in the Blank" },
  { value: "cloze", label: "Cloze Test" },
  { value: "match", label: "Matching" },
  { value: "order", label: "Ordering" },
  { value: "mixed", label: "Mixed Types" }
]

const difficultyLevels = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" }
]

const locales = [
  { value: "ru", label: "Russian" },
  { value: "en", label: "English" }
]

export default function TestBuilderPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [selectedDocument, setSelectedDocument] = useState<any>(null)
  const [testConfig, setTestConfig] = useState({
    count: 5,
    type: "mcq",
    difficulty: "medium",
    locale: "ru"
  })
  const [context, setContext] = useState({
    text: "",
    facts: [],
    steps: [],
    definitions: []
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }
  }, [session, status, router])

  const handleDocumentSelect = (doc: any) => {
    setSelectedDocument(doc)
    // In real app, you would fetch document content here
    setContext(prev => ({
      ...prev,
      text: `Content from ${doc.name} would be loaded here...`
    }))
  }


  const generateHmacSignature = (data: any, secret: string) => {
    const crypto = require('crypto')
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(data))
      .digest('hex')
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

      // Generate HMAC signature
      const hmacSecret = process.env.NEXT_PUBLIC_HMAC_SECRET || "test-secret-key"
      const signature = generateHmacSignature(requestData, hmacSecret)

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
                  <CardTitle>Generated Questions</CardTitle>
                  <CardDescription>
                    {generatedQuestions.length} questions generated successfully
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {generatedQuestions.map((question, index) => (
                      <div key={question.id || index} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium">Question {index + 1}</h4>
                          <Badge variant="outline">{question.type}</Badge>
                        </div>
                        <p className="text-sm text-gray-700 mb-3">{question.prompt}</p>
                        {question.choices && (
                          <div className="space-y-1">
                            {question.choices.map((choice: string, choiceIndex: number) => (
                              <div key={choiceIndex} className="text-sm text-gray-600">
                                {String.fromCharCode(65 + choiceIndex)}. {choice}
                              </div>
                            ))}
                          </div>
                        )}
                        {question.explanation && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                            <strong>Explanation:</strong> {question.explanation}
                          </div>
                        )}
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
