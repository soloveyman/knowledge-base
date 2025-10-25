"use client"

import { useRouter } from "next/navigation"
import { FileText, Plus } from "lucide-react"
import { ManagementPage } from "../common/management-page"

interface Document {
  id: string
  name: string
  type: string
  uploadedAt: string
}

interface DocumentsPageProps {
  documents: Document[]
  onDeleteDocument: (id: string) => void
  onViewDocument: (name: string) => void
  onImportDocument?: () => void
}

export function DocumentsPage({ 
  documents, 
  onDeleteDocument, 
  onViewDocument,
  onImportDocument
}: DocumentsPageProps) {
  const router = useRouter()

  const documentItems = documents.map((doc) => ({
    id: doc.id,
    title: doc.name,
    subtitle: `${doc.type} • Uploaded ${doc.uploadedAt}`,
    onClick: () => onViewDocument(doc.name),
    onDelete: () => onDeleteDocument(doc.id)
  }))

  return (
    <ManagementPage
      title="Uploaded Documents"
      description="View and manage your uploaded documents"
      icon={<FileText className="h-8 w-8" />}
      actionButton={{
        label: "Import Document",
        icon: <Plus className="h-4 w-4" />,
        onClick: onImportDocument || (() => router.push('/docs/import'))
      }}
      items={documentItems}
      emptyState={{
        icon: <FileText className="h-12 w-12" />,
        title: "No documents uploaded yet",
        description: "Upload your first document to get started",
        actionLabel: "Import Document",
        onAction: onImportDocument || (() => router.push('/docs/import'))
      }}
    />
  )
}
