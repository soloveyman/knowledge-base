"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
  Wand2, 
  Settings, 
  Eye, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Target,
  HelpCircle,
  Brain,
  Zap
} from "lucide-react"

interface GenerationParams {
  moduleId: string
  sectionIds: string[]
  questionCount: number
  questionTypes: string[]
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  timeLimit?: number
  includeExplanations: boolean
}

interface GeneratedQuestion {
  id: string
  title: string
  content: string
  type: 'multiple_choice' | 'true_false' | 'text'
  options?: string[]
  correctAnswer: string
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
  confidence: number
  requiresReview: boolean
  sourceSection: string
}

interface TestGeneratorProps {
  moduleId: string
  sections: Array<{
    id: string
    title: string
    content: string
  }>
  onGenerate?: (questions: GeneratedQuestion[]) => void
  onSave?: (testData: any) => void
}

export default function TestGenerator({ 
  moduleId, 
  sections, 
  onGenerate,
  onSave 
}: TestGeneratorProps) {
  const [params, setParams] = useState<GenerationParams>({
    moduleId,
    sectionIds: [],
    questionCount: 10,
    questionTypes: ['multiple_choice'],
    difficulty: 'mixed',
    timeLimit: undefined,
    includeExplanations: true
  })

  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)

  const questionTypeOptions = [
    { value: 'multiple_choice', label: 'Multiple Choice', icon: '○' },
    { value: 'true_false', label: 'True/False', icon: '✓' },
    { value: 'text', label: 'Text Answer', icon: 'T' }
  ]

  const difficultyOptions = [
    { value: 'easy', label: 'Easy', color: 'bg-green-100 text-green-800' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'hard', label: 'Hard', color: 'bg-red-100 text-red-800' },
    { value: 'mixed', label: 'Mixed', color: 'bg-blue-100 text-blue-800' }
  ]

  const handleParamChange = (field: keyof GenerationParams, value: any) => {
    setParams(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSectionToggle = (sectionId: string) => {
    setParams(prev => ({
      ...prev,
      sectionIds: prev.sectionIds.includes(sectionId)
        ? prev.sectionIds.filter(id => id !== sectionId)
        : [...prev.sectionIds, sectionId]
    }))
  }

  const handleQuestionTypeToggle = (type: string) => {
    setParams(prev => ({
      ...prev,
      questionTypes: prev.questionTypes.includes(type)
        ? prev.questionTypes.filter(t => t !== type)
        : [...prev.questionTypes, type]
    }))
  }

  const generateQuestions = async () => {
    if (params.sectionIds.length === 0) {
      setError('Please select at least one section to generate questions from')
      return
    }

    setIsGenerating(true)
    setGenerationProgress(0)
    setError(null)

    try {
      // Simulate generation progress
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + Math.random() * 15
        })
      }, 500)

      // Simulate API call to test generation service
      await new Promise(resolve => setTimeout(resolve, 3000))
      clearInterval(progressInterval)
      setGenerationProgress(100)

      // Mock generated questions
      const mockQuestions: GeneratedQuestion[] = [
        {
          id: '1',
          title: 'Food Safety Basics',
          content: 'What is the minimum internal temperature for cooking poultry?',
          type: 'multiple_choice',
          options: ['160°F (71°C)', '165°F (74°C)', '170°F (77°C)', '175°F (79°C)'],
          correctAnswer: '165°F (74°C)',
          explanation: 'Poultry must be cooked to 165°F (74°C) to ensure all harmful bacteria are destroyed.',
          difficulty: 'medium',
          confidence: 85,
          requiresReview: false,
          sourceSection: 'Temperature Control'
        },
        {
          id: '2',
          title: 'Hygiene Practices',
          content: 'Hand washing should be done for at least 20 seconds.',
          type: 'true_false',
          correctAnswer: 'true',
          explanation: 'The CDC recommends washing hands for at least 20 seconds with soap and water.',
          difficulty: 'easy',
          confidence: 95,
          requiresReview: false,
          sourceSection: 'Personal Hygiene'
        },
        {
          id: '3',
          title: 'Cross Contamination',
          content: 'Describe the proper procedure for cleaning and sanitizing cutting boards.',
          type: 'text',
          correctAnswer: 'Wash with hot soapy water, rinse, sanitize with bleach solution, air dry',
          explanation: 'Proper cleaning involves washing, rinsing, sanitizing, and air drying to prevent cross-contamination.',
          difficulty: 'hard',
          confidence: 70,
          requiresReview: true,
          sourceSection: 'Cross Contamination Prevention'
        }
      ]

      setGeneratedQuestions(mockQuestions)
      setIsGenerating(false)

      if (onGenerate) {
        onGenerate(mockQuestions)
      }

    } catch (err) {
      setError('Failed to generate questions. Please try again.')
      setIsGenerating(false)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600'
    if (confidence >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const renderQuestionPreview = (question: GeneratedQuestion) => {
    return (
      <div className="space-y-3 p-4 border rounded-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-medium">{question.title}</h4>
            <p className="text-sm text-gray-600 mt-1">{question.content}</p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Badge className={getDifficultyColor(question.difficulty)}>
              {question.difficulty}
            </Badge>
            {question.requiresReview && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                <AlertCircle className="h-3 w-3 mr-1" />
                Review
              </Badge>
            )}
          </div>
        </div>

        {question.type === 'multiple_choice' && question.options && (
          <div className="space-y-1">
            {question.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <span className="w-4 h-4 border rounded-full flex items-center justify-center text-xs">
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{option}</span>
                {option === question.correctAnswer && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
            ))}
          </div>
        )}

        {question.type === 'true_false' && (
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-sm">
              <input type="radio" disabled className="w-4 h-4" />
              <span>True</span>
              {question.correctAnswer === 'true' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <input type="radio" disabled className="w-4 h-4" />
              <span>False</span>
              {question.correctAnswer === 'false' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </div>
          </div>
        )}

        {question.explanation && (
          <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
            <strong>Explanation:</strong> {question.explanation}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Source: {question.sourceSection}</span>
          <div className="flex items-center gap-2">
            <span className={getConfidenceColor(question.confidence)}>
              {question.confidence}% confidence
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Generation Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Test Generation Parameters
          </CardTitle>
          <CardDescription>
            Configure how questions should be generated from your content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Section Selection */}
          <div>
            <Label className="text-base font-medium">Select Sections</Label>
            <p className="text-sm text-gray-600 mb-3">
              Choose which sections to generate questions from
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    params.sectionIds.includes(section.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleSectionToggle(section.id)}
                >
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={params.sectionIds.includes(section.id)}
                      onChange={() => handleSectionToggle(section.id)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{section.title}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {section.content.substring(0, 100)}...
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Question Count */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="questionCount">Number of Questions</Label>
              <Input
                id="questionCount"
                type="number"
                min="1"
                max="50"
                value={params.questionCount}
                onChange={(e) => handleParamChange('questionCount', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
              <Input
                id="timeLimit"
                type="number"
                min="5"
                value={params.timeLimit || ''}
                onChange={(e) => handleParamChange('timeLimit', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="No limit"
              />
            </div>
          </div>

          {/* Question Types */}
          <div>
            <Label className="text-base font-medium">Question Types</Label>
            <p className="text-sm text-gray-600 mb-3">
              Select which types of questions to generate
            </p>
            <div className="flex flex-wrap gap-2">
              {questionTypeOptions.map((type) => (
                <Button
                  key={type.value}
                  variant={params.questionTypes.includes(type.value) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleQuestionTypeToggle(type.value)}
                  className="flex items-center gap-2"
                >
                  <span>{type.icon}</span>
                  {type.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <Label className="text-base font-medium">Difficulty Level</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {difficultyOptions.map((difficulty) => (
                <Button
                  key={difficulty.value}
                  variant={params.difficulty === difficulty.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleParamChange('difficulty', difficulty.value)}
                  className={params.difficulty === difficulty.value ? '' : 'hover:bg-gray-50'}
                >
                  {difficulty.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="includeExplanations"
              checked={params.includeExplanations}
              onChange={(e) => handleParamChange('includeExplanations', e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="includeExplanations">Include explanations for answers</Label>
          </div>

          {/* Generate Button */}
          <div className="flex items-center gap-4 pt-4 border-t">
            <Button
              onClick={generateQuestions}
              disabled={isGenerating || params.sectionIds.length === 0}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {isGenerating ? 'Generating...' : 'Generate Questions'}
            </Button>
            
            {generatedQuestions.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setPreviewMode(!previewMode)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {previewMode ? 'Hide Preview' : 'Show Preview'}
              </Button>
            )}
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Generating questions...</span>
                <span>{Math.round(generationProgress)}%</span>
              </div>
              <Progress value={generationProgress} className="w-full" />
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Generated Questions Preview */}
      {generatedQuestions.length > 0 && previewMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Generated Questions Preview
            </CardTitle>
            <CardDescription>
              Review and edit the generated questions before creating your test
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {generatedQuestions.map((question, index) => (
                <div key={question.id}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Question {index + 1}</h4>
                    <div className="flex items-center gap-2">
                      <Badge className={getDifficultyColor(question.difficulty)}>
                        {question.difficulty}
                      </Badge>
                      <span className={`text-sm ${getConfidenceColor(question.confidence)}`}>
                        {question.confidence}% confidence
                      </span>
                    </div>
                  </div>
                  {renderQuestionPreview(question)}
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button onClick={() => onSave && onSave({ questions: generatedQuestions, params })}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create Test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
