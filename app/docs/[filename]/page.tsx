"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { 
  FileText, 
  Calendar,
  User,
  X,
  Info
} from "lucide-react"
import { useParams } from "next/navigation"

export default function DocumentViewer() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const filename = params.filename as string

  const [documentData, setDocumentData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Simulate loading document data
    setLoading(false)
    setDocumentData({
      name: decodeURIComponent(filename),
      type: filename.split('.').pop()?.toUpperCase() || 'DOCX',
      uploadedAt: new Date().toISOString(),
      uploadedBy: session.user?.name || 'Unknown',
      size: '2.5 MB',
      content: 'Document content will be displayed here...'
    })
  }, [session, status, router, filename])

  const handleClose = () => {
    // Navigate back to the manager page with docs tab active
    router.push('/manager?tab=docs')
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
              <FileText className="h-8 w-8 text-blue-600 mr-3 shrink-0" />
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                {documentData?.name || 'Document Viewer'}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Info className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="p-3">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">File Name</label>
                        <p className="text-sm text-gray-900 mt-1 break-all">{documentData?.name}</p>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">File Type</label>
                        <div className="mt-1">
                          <Badge variant="secondary">{documentData?.type}</Badge>
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">File Size</label>
                        <p className="text-sm text-gray-900 mt-1">{documentData?.size}</p>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Uploaded</label>
                        <div className="flex items-center mt-1 text-sm text-gray-600">
                          <Calendar className="h-4 w-4 mr-2" />
                          {documentData?.uploadedAt ? new Date(documentData.uploadedAt).toLocaleDateString() : 'Unknown'}
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Uploaded By</label>
                        <div className="flex items-center mt-1 text-sm text-gray-600">
                          <User className="h-4 w-4 mr-2" />
                          {documentData?.uploadedBy}
                        </div>
                      </div>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Document Content */}
        <div className="min-h-screen">
          {documentData?.type === 'PDF' ? (
            <div className="w-full h-screen border border-gray-200 rounded-lg overflow-hidden">
              <iframe 
                src={`/api/documents/${encodeURIComponent(filename)}`}
                className="w-full h-full"
                title={documentData?.name}
              />
            </div>
          ) : (
            <div className="prose max-w-none">
              <h1>Ланч меню BS</h1>
              <h2>Основные блюда</h2>
              <ul>
                <li>Борщ украинский с мясом - 250₽</li>
                <li>Суп-пюре из тыквы - 200₽</li>
                <li>Куриный бульон с лапшой - 180₽</li>
              </ul>
              
              <h2>Салаты</h2>
              <ul>
                <li>Цезарь с курицей - 320₽</li>
                <li>Греческий салат - 280₽</li>
                <li>Салат из свежих овощей - 200₽</li>
              </ul>
              
              <h2>Горячие блюда</h2>
              <ul>
                <li>Котлета по-киевски с картофелем - 450₽</li>
                <li>Рыба на гриле с рисом - 380₽</li>
                <li>Паста карбонара - 350₽</li>
                <li>Плов с бараниной - 420₽</li>
              </ul>
              
              <h2>Напитки</h2>
              <ul>
                <li>Свежевыжатый апельсиновый сок - 150₽</li>
                <li>Чай/кофе - 80₽</li>
                <li>Минеральная вода - 60₽</li>
              </ul>
              
              <h2>Десерты</h2>
              <ul>
                <li>Тирамису - 200₽</li>
                <li>Чизкейк - 180₽</li>
                <li>Мороженое (3 шарика) - 120₽</li>
              </ul>
              
              <p><em>Все цены указаны в рублях. Меню может изменяться в зависимости от сезона.</em></p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}