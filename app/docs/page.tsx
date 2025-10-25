"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { PageLayout } from "@/components/common/page-layout"
import { DocumentsPage } from "@/components/pages/documents-page"
import { FileText } from "lucide-react"

interface Document {
  id: string
  name: string
  type: string
  uploadedAt: string
  size?: string
  status?: 'processing' | 'ready' | 'error'
}

export default function DocsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Load documents from localStorage
    loadDocuments()
  }, [session, status, router])

  const loadDocuments = () => {
    try {
      const savedDocs = JSON.parse(localStorage.getItem('savedDocuments') || '[]')
      if (savedDocs.length === 0) {
        // Load mock documents if none saved
        const mockDocs: Document[] = [
          { id: "1", name: "Ланч меню BS.docx", type: "DOCX", uploadedAt: "2 hours ago", size: "2.3 MB", status: "ready" },
          { id: "2", name: "Training Schedule.xlsx", type: "XLSX", uploadedAt: "1 day ago", size: "1.8 MB", status: "ready" },
          { id: "3", name: "Employee Handbook.docx", type: "DOCX", uploadedAt: "5 minutes ago", size: "4.1 MB", status: "ready" },
          { id: "4", name: "Safety Guidelines.pdf", type: "PDF", uploadedAt: "1 hour ago", size: "3.2 MB", status: "ready" }
        ]
        setDocuments(mockDocs)
        localStorage.setItem('savedDocuments', JSON.stringify(mockDocs))
      } else {
        setDocuments(savedDocs)
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteDocument = (id: string) => {
    const updatedDocs = documents.filter(doc => doc.id !== id)
    setDocuments(updatedDocs)
    localStorage.setItem('savedDocuments', JSON.stringify(updatedDocs))
  }

  const handleViewDocument = (name: string) => {
    router.push(`/docs/${encodeURIComponent(name)}`)
  }

  const handleImportDocument = () => {
    router.push('/docs/import')
  }

  if (status === "loading" || isLoading) {
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
    <PageLayout
      title="Document Management"
      icon={<FileText className="h-8 w-8" />}
      onClose={() => router.push('/manager?tab=docs')}
    >
      <DocumentsPage
        documents={documents}
        onDeleteDocument={handleDeleteDocument}
        onViewDocument={handleViewDocument}
        onImportDocument={handleImportDocument}
      />
    </PageLayout>
  )
}
