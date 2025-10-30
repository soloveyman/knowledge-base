"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { PageLayout } from "@/components/common/page-layout"
import { DocumentsPage } from "@/components/pages/documents-page"
import { cleanupDocumentFromLocalStorage } from "@/lib/localStorage-utils"
import { FileText } from "lucide-react"

interface Document {
  id: string
  name: string
  type: string
  uploadedAt: string
  size?: string
  status?: 'processing' | 'ready' | 'error'
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function DocsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('docs-page-documents')
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })
  const [isLoading, setIsLoading] = useState(true)

  // Debug wrapper for setDocuments
  const setDocumentsWithLog = (newDocuments: Document[]) => {
    console.log('DocsPage: setDocuments called with:', newDocuments.length, 'documents')
    if (newDocuments.length === 0) {
      console.log('DocsPage: WARNING - Documents being cleared!')
      console.trace('DocsPage: Stack trace for document clearing:')
    } else {
      // Save to localStorage to persist across re-mounts
      try {
        localStorage.setItem('docs-page-documents', JSON.stringify(newDocuments))
      } catch (error) {
        console.error('Failed to save documents to localStorage:', error)
      }
    }
    setDocuments(newDocuments)
  }

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Load documents from localStorage
    loadDocuments()
  }, [session, status, router])

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/documents')
      const result = await response.json()
      
      if (result.success) {
        console.log('Raw documents from API:', result.data.documents)
        // Transform database documents to match the expected format
        interface ApiDocument {
          id: string | number
          originalFileName?: string
          title?: string
          fileType?: string
          createdAt?: string
          fileSize?: number
          status?: string
        }
        
        const transformedDocs = (result.data.documents as ApiDocument[]).map((doc: ApiDocument) => {
          // Normalize status to our discriminated union
          const normalizedStatus: Document['status'] =
            doc.status === 'processing' ? 'processing'
            : doc.status === 'error' ? 'error'
            : 'ready'

          return {
            id: String(doc.id),
            name: doc.originalFileName || doc.title || 'Untitled',
            type: doc.fileType?.toUpperCase() || 'UNKNOWN',
            uploadedAt: doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
            size: doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown',
            status: normalizedStatus,
          }
        })
        console.log('Transformed documents:', transformedDocs)
        setDocumentsWithLog(transformedDocs)
      } else {
        console.error('Failed to load documents:', result.message)
        setDocumentsWithLog([])
      }
    } catch (error) {
      console.error('Error loading documents:', error)
      setDocumentsWithLog([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Remove from local state
        const updatedDocs = documents.filter(doc => doc.id !== id)
        setDocumentsWithLog(updatedDocs)
        
        // Clean up localStorage when document is deleted
        cleanupDocumentFromLocalStorage(id)
      } else {
        console.error('Failed to delete document')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  const handleViewDocument = (name: string) => {
    console.log('handleViewDocument called with name:', name)
    console.log('Encoded name:', encodeURIComponent(name))
    router.push(`/docs/${encodeURIComponent(name)}`)
  }

  const handleImportDocument = () => {
    router.push('/docs/import?returnTo=/docs')
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
