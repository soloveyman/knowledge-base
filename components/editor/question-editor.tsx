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
import { 
  Save, 
  Plus, 
  Trash2, 
  Eye, 
  Edit3, 
  CheckCircle, 
  AlertCircle,
  Tag,
  HelpCircle,
  Clock,
  Target
} from "lucide-react"

interface QuestionOption {
  id: string
  text: string
  isCorrect: boolean
}

interface Question {
  id: string
  title: string
  content: string
  type: 'multiple_choice' | 'true_false' | 'text'
  options: QuestionOption[]
  correctAnswer: string
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  confidence?: number
  requiresReview: boolean
}

interface QuestionEditorProps {
  question?: Question
  onSave?: (question: Question) => void
  onCancel?: () => void
  readOnly?: boolean
}

export default function QuestionEditor({ 
  question, 
  onSave, 
  onCancel,
  readOnly = false 
}: QuestionEditorProps) {
  const [formData, setFormData] = useState<Question>(question || {
    id: '',
    title: '',
    content: '',
    type: 'multiple_choice',
    options: [
      { id: '1', text: '', isCorrect: false },
      { id: '2', text: '', isCorrect: false },
      { id: '3', text: '', isCorrect: false },
      { id: '4', text: '', isCorrect: false }
    ],
    correctAnswer: '',
    explanation: '',
    difficulty: 'medium',
    tags: [],
    requiresReview: false
  })

  const [newTag, setNewTag] = useState('')
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (question) {
      setFormData(question)
    }
  }, [question])

  const handleInputChange = (field: keyof Question, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  const handleOptionChange = (optionId: string, field: keyof QuestionOption, value: any) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map(option => 
        option.id === optionId 
          ? { ...option, [field]: value }
          : option
      )
    }))
  }

  const addOption = () => {
    const newId = (formData.options.length + 1).toString()
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, { id: newId, text: '', isCorrect: false }]
    }))
  }

  const removeOption = (optionId: string) => {
    if (formData.options.length > 2) {
      setFormData(prev => ({
        ...prev,
        options: prev.options.filter(option => option.id !== optionId)
      }))
    }
  }

  const handleCorrectAnswerChange = (optionId: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map(option => ({
        ...option,
        isCorrect: option.id === optionId
      })),
      correctAnswer: optionId
    }))
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Question title is required'
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Question content is required'
    }

    if (formData.type === 'multiple_choice') {
      const hasValidOptions = formData.options.every(option => option.text.trim())
      if (!hasValidOptions) {
        newErrors.options = 'All options must have text'
      }

      const hasCorrectAnswer = formData.options.some(option => option.isCorrect)
      if (!hasCorrectAnswer) {
        newErrors.correctAnswer = 'Please select a correct answer'
      }
    }

    if (formData.type === 'text' && !formData.correctAnswer.trim()) {
      newErrors.correctAnswer = 'Correct answer is required for text questions'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (validateForm()) {
      if (onSave) {
        onSave(formData)
      }
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const renderQuestionPreview = () => {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-lg">{formData.title || 'Untitled Question'}</h3>
          <p className="text-gray-600 mt-1">{formData.content || 'No content provided'}</p>
        </div>

        {formData.type === 'multiple_choice' && (
          <div className="space-y-2">
            {formData.options.map((option, index) => (
              <div key={option.id} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="preview-answer"
                  disabled
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  {String.fromCharCode(65 + index)}. {option.text || `Option ${index + 1}`}
                </span>
                {option.isCorrect && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
            ))}
          </div>
        )}

        {formData.type === 'true_false' && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input type="radio" name="preview-tf" disabled className="w-4 h-4" />
              <span className="text-sm">True</span>
            </div>
            <div className="flex items-center space-x-2">
              <input type="radio" name="preview-tf" disabled className="w-4 h-4" />
              <span className="text-sm">False</span>
            </div>
          </div>
        )}

        {formData.type === 'text' && (
          <div>
            <Textarea
              placeholder="Student will type their answer here..."
              disabled
              className="min-h-[100px]"
            />
          </div>
        )}

        {formData.explanation && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-sm mb-1">Explanation:</h4>
            <p className="text-sm text-gray-600">{formData.explanation}</p>
          </div>
        )}
      </div>
    )
  }

  if (readOnly) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Question Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderQuestionPreview()}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              {question ? 'Edit Question' : 'Create Question'}
            </CardTitle>
            <CardDescription>
              {question ? 'Update question details and settings' : 'Create a new question for your test'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getDifficultyColor(formData.difficulty)}>
              {formData.difficulty}
            </Badge>
            {formData.requiresReview && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                <AlertCircle className="h-3 w-3 mr-1" />
                Review Required
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Question Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter a descriptive title for this question"
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && (
              <p className="text-sm text-red-500 mt-1">{errors.title}</p>
            )}
          </div>

          <div>
            <Label htmlFor="content">Question Content *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              placeholder="Enter the question text here..."
              className={errors.content ? 'border-red-500' : ''}
              rows={3}
            />
            {errors.content && (
              <p className="text-sm text-red-500 mt-1">{errors.content}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Question Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => handleInputChange('type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="true_false">True/False</SelectItem>
                  <SelectItem value="text">Text Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                value={formData.difficulty}
                onValueChange={(value) => handleInputChange('difficulty', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Answer Options */}
        {formData.type === 'multiple_choice' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Answer Options</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                disabled={formData.options.length >= 6}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            </div>

            {errors.options && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.options}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              {formData.options.map((option, index) => (
                <div key={option.id} className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="correct-answer"
                    checked={option.isCorrect}
                    onChange={() => handleCorrectAnswerChange(option.id)}
                    className="w-4 h-4"
                  />
                  <Input
                    value={option.text}
                    onChange={(e) => handleOptionChange(option.id, 'text', e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1"
                  />
                  {formData.options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(option.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {errors.correctAnswer && (
              <p className="text-sm text-red-500">{errors.correctAnswer}</p>
            )}
          </div>
        )}

        {formData.type === 'text' && (
          <div>
            <Label htmlFor="correctAnswer">Correct Answer</Label>
            <Textarea
              id="correctAnswer"
              value={formData.correctAnswer}
              onChange={(e) => handleInputChange('correctAnswer', e.target.value)}
              placeholder="Enter the correct answer or key points..."
              rows={3}
              className={errors.correctAnswer ? 'border-red-500' : ''}
            />
            {errors.correctAnswer && (
              <p className="text-sm text-red-500 mt-1">{errors.correctAnswer}</p>
            )}
          </div>
        )}

        {/* Explanation */}
        <div>
          <Label htmlFor="explanation">Explanation (Optional)</Label>
          <Textarea
            id="explanation"
            value={formData.explanation}
            onChange={(e) => handleInputChange('explanation', e.target.value)}
            placeholder="Explain why this is the correct answer..."
            rows={3}
          />
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 hover:text-red-500"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add a tag..."
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            />
            <Button type="button" variant="outline" onClick={addTag}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {question ? 'Update Question' : 'Create Question'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
