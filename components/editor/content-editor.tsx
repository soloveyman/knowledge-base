"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Save, 
  Eye, 
  Edit3, 
  Bold, 
  Italic, 
  List, 
  ListOrdered,
  Link,
  Image,
  Table,
  Code,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo
} from "lucide-react"

interface Section {
  id: string
  title: string
  content: string
  level: number
  order: number
}

interface ContentEditorProps {
  moduleId?: string
  initialContent?: string
  sections?: Section[]
  onSave?: (content: string, sections: Section[]) => void
  readOnly?: boolean
}

export default function ContentEditor({ 
  moduleId, 
  initialContent = "", 
  sections = [],
  onSave,
  readOnly = false 
}: ContentEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [editorSections, setEditorSections] = useState<Section[]>(sections)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [history, setHistory] = useState<string[]>([initialContent])
  const [historyIndex, setHistoryIndex] = useState(0)
  
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editorRef.current && !readOnly) {
      editorRef.current.focus()
    }
  }, [isEditing, readOnly])

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newContent)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setContent(history[newIndex])
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setContent(history[newIndex])
    }
  }

  const insertMarkdown = (before: string, after: string = '') => {
    if (editorRef.current) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const selectedText = range.toString()
        const newText = before + selectedText + after
        range.deleteContents()
        range.insertNode(document.createTextNode(newText))
        
        // Update content
        const newContent = editorRef.current.innerHTML
        handleContentChange(newContent)
      }
    }
  }

  const formatText = (format: string) => {
    const formats: { [key: string]: { before: string; after: string } } = {
      bold: { before: '**', after: '**' },
      italic: { before: '*', after: '*' },
      code: { before: '`', after: '`' },
      quote: { before: '> ', after: '' },
      h1: { before: '# ', after: '' },
      h2: { before: '## ', after: '' },
      h3: { before: '### ', after: '' },
      link: { before: '[', after: '](url)' },
      image: { before: '![', after: '](url)' }
    }

    if (formats[format]) {
      insertMarkdown(formats[format].before, formats[format].after)
    }
  }

  const insertList = (ordered: boolean = false) => {
    const prefix = ordered ? '1. ' : '- '
    insertMarkdown(prefix, '')
  }

  const insertTable = () => {
    const tableMarkdown = `| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`
    
    insertMarkdown('\n' + tableMarkdown + '\n', '')
  }

  const handleSave = () => {
    if (onSave) {
      onSave(content, editorSections)
    }
    setIsEditing(false)
  }

  const parseSections = (content: string): Section[] => {
    const lines = content.split('\n')
    const sections: Section[] = []
    let order = 0

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (trimmedLine.startsWith('# ')) {
        sections.push({
          id: `section-${index}`,
          title: trimmedLine.substring(2),
          content: '',
          level: 1,
          order: order++
        })
      } else if (trimmedLine.startsWith('## ')) {
        sections.push({
          id: `section-${index}`,
          title: trimmedLine.substring(3),
          content: '',
          level: 2,
          order: order++
        })
      } else if (trimmedLine.startsWith('### ')) {
        sections.push({
          id: `section-${index}`,
          title: trimmedLine.substring(4),
          content: '',
          level: 3,
          order: order++
        })
      }
    })

    return sections
  }

  const renderPreview = () => {
    // Simple markdown to HTML conversion (in production, use a proper markdown parser)
    let html = content
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/\n/g, '<br>')

    return <div dangerouslySetInnerHTML={{ __html: html }} />
  }

  const toolbarButtons = [
    { icon: Bold, action: () => formatText('bold'), tooltip: 'Bold' },
    { icon: Italic, action: () => formatText('italic'), tooltip: 'Italic' },
    { icon: Code, action: () => formatText('code'), tooltip: 'Code' },
    { icon: Quote, action: () => formatText('quote'), tooltip: 'Quote' },
    { icon: Heading1, action: () => formatText('h1'), tooltip: 'Heading 1' },
    { icon: Heading2, action: () => formatText('h2'), tooltip: 'Heading 2' },
    { icon: Heading3, action: () => formatText('h3'), tooltip: 'Heading 3' },
    { icon: List, action: () => insertList(false), tooltip: 'Bullet List' },
    { icon: ListOrdered, action: () => insertList(true), tooltip: 'Numbered List' },
    { icon: Link, action: () => formatText('link'), tooltip: 'Link' },
    { icon: Image, action: () => formatText('image'), tooltip: 'Image' },
    { icon: Table, action: insertTable, tooltip: 'Table' }
  ]

  if (readOnly) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Content Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            {renderPreview()}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Content Editor</CardTitle>
            <CardDescription>
              Edit your module content with markdown support
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {content.length} characters
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
            >
              <Redo className="h-4 w-4" />
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'edit' | 'preview')}>
          <TabsList>
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 border rounded-lg bg-gray-50">
              {toolbarButtons.map((button, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={button.action}
                  title={button.tooltip}
                  className="h-8 w-8 p-0"
                >
                  <button.icon className="h-4 w-4" />
                </Button>
              ))}
            </div>

            {/* Editor */}
            <div className="border rounded-lg">
              <div
                ref={editorRef}
                contentEditable
                className="min-h-[400px] p-4 focus:outline-none"
                style={{ whiteSpace: 'pre-wrap' }}
                onInput={(e) => {
                  const target = e.target as HTMLDivElement
                  handleContentChange(target.innerHTML)
                }}
                suppressContentEditableWarning={true}
              >
                {content}
              </div>
            </div>

            {/* Sections Overview */}
            {editorSections.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Document Structure</h4>
                <div className="space-y-1">
                  {editorSections.map((section) => (
                    <div key={section.id} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs">
                        H{section.level}
                      </Badge>
                      <span>{section.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <div className="prose max-w-none p-4 border rounded-lg min-h-[400px]">
              {renderPreview()}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
