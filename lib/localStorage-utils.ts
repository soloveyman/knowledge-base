/**
 * Utility functions for managing localStorage data
 */

export interface Document {
  id: string
  name?: string
  type?: string
  content?: string
  [key: string]: unknown
}

const MANAGER_DOCUMENTS_KEY = 'manager-documents'

/**
 * Clean up localStorage when a document is deleted
 */
export function cleanupDocumentFromLocalStorage(documentId: string): void {
  try {
    console.log('LocalStorage: Starting cleanup for document:', documentId)
    
    // Clean up main documents storage
    const savedDocuments = localStorage.getItem(MANAGER_DOCUMENTS_KEY)
    if (savedDocuments && savedDocuments !== 'undefined' && savedDocuments !== 'null') {
      const documents = JSON.parse(savedDocuments)
      if (Array.isArray(documents)) {
        const updatedDocuments = documents.filter((doc: Document) => doc.id !== documentId)
        localStorage.setItem(MANAGER_DOCUMENTS_KEY, JSON.stringify(updatedDocuments))
        console.log('LocalStorage: Cleaned up document from main storage:', documentId)
      } else {
        // If documents is not an array, clear the localStorage
        localStorage.removeItem(MANAGER_DOCUMENTS_KEY)
        console.log('LocalStorage: Cleared invalid data and removed document:', documentId)
      }
    } else {
      console.log('LocalStorage: No valid documents data found, skipping cleanup for:', documentId)
    }
    
    // Clean up any cached parsing results by filename
    const filename = documentId.split('-').pop() // Extract filename if ID contains it
    if (filename) {
      const cacheKeys = Object.keys(localStorage).filter(key => 
        key.includes(filename) || key.includes('parsed') || key.includes('cache')
      )
      cacheKeys.forEach(key => {
        localStorage.removeItem(key)
        console.log('LocalStorage: Removed cache key:', key)
      })
    }
    
    // Force clear any browser cache for this document
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.open(cacheName).then(cache => {
            cache.keys().then(requests => {
              requests.forEach(request => {
                if (request.url.includes(documentId) || request.url.includes(filename || '')) {
                  cache.delete(request)
                  console.log('LocalStorage: Cleared browser cache for:', request.url)
                }
              })
            })
          })
        })
      })
    }
    
    console.log('LocalStorage: Complete cleanup finished for document:', documentId)
  } catch (error) {
    console.error('LocalStorage: Failed to clean up document:', error)
    // If there's any error, clear the localStorage to prevent future issues
    localStorage.removeItem(MANAGER_DOCUMENTS_KEY)
    console.log('LocalStorage: Cleared localStorage due to error')
  }
}

/**
 * Clean up all localStorage data for documents
 */
export function clearAllDocumentLocalStorage(): void {
  try {
    localStorage.removeItem(MANAGER_DOCUMENTS_KEY)
    console.log('LocalStorage: Cleared all document data')
  } catch (error) {
    console.error('LocalStorage: Failed to clear document data:', error)
  }
}

/**
 * Get documents from localStorage
 */
export function getDocumentsFromLocalStorage(): Document[] {
  try {
    const savedDocuments = localStorage.getItem(MANAGER_DOCUMENTS_KEY)
    if (savedDocuments && savedDocuments !== 'undefined' && savedDocuments !== 'null') {
      const documents = JSON.parse(savedDocuments)
      if (Array.isArray(documents)) {
        return documents
      } else {
        // If documents is not an array, clear the localStorage and return empty array
        localStorage.removeItem(MANAGER_DOCUMENTS_KEY)
        console.log('LocalStorage: Cleared invalid data, returning empty array')
        return []
      }
    }
    return []
  } catch (error) {
    console.error('LocalStorage: Failed to get documents:', error)
    // If there's any error, clear the localStorage to prevent future issues
    localStorage.removeItem(MANAGER_DOCUMENTS_KEY)
    console.log('LocalStorage: Cleared localStorage due to error')
    return []
  }
}

/**
 * Save documents to localStorage
 */
export function saveDocumentsToLocalStorage(documents: Document[]): void {
  try {
    localStorage.setItem(MANAGER_DOCUMENTS_KEY, JSON.stringify(documents))
    console.log('LocalStorage: Saved', documents.length, 'documents')
  } catch (error) {
    console.error('LocalStorage: Failed to save documents:', error)
  }
}

/**
 * Sync localStorage with database documents
 * Removes any localStorage documents that don't exist in the database
 */
export function syncLocalStorageWithDatabase(
  databaseDocuments: Array<{ id: string; [key: string]: unknown }>
): void {
  try {
    const localDocuments = getDocumentsFromLocalStorage()
    const databaseIds = new Set(databaseDocuments.map(doc => doc.id))
    
    // Filter out documents that don't exist in the database
    const validDocuments = localDocuments.filter((doc: Document) => databaseIds.has(doc.id))
    
    if (validDocuments.length !== localDocuments.length) {
      saveDocumentsToLocalStorage(validDocuments)
      console.log('LocalStorage: Synced with database, removed', localDocuments.length - validDocuments.length, 'stale documents')
    }
  } catch (error) {
    console.error('LocalStorage: Failed to sync with database:', error)
    // If there's any error, clear the localStorage to prevent future issues
    localStorage.removeItem(MANAGER_DOCUMENTS_KEY)
    console.log('LocalStorage: Cleared localStorage due to sync error')
  }
}

/**
 * Check if localStorage has stale data
 */
export function hasStaleLocalStorageData(databaseDocuments: Document[]): boolean {
  try {
    const localDocuments = getDocumentsFromLocalStorage()
    const databaseIds = new Set(databaseDocuments.map(doc => doc.id))
    
    // Check if any local documents don't exist in the database
    return localDocuments.some((doc: Document) => !databaseIds.has(doc.id))
  } catch (error) {
    console.error('LocalStorage: Failed to check for stale data:', error)
    return false
  }
}

/**
 * Clear all parsing-related cache to force fresh parsing
 */
export function clearParsingCache(): void {
  try {
    console.log('LocalStorage: Clearing all parsing cache...')
    
    // Get all localStorage keys
    const keys = Object.keys(localStorage)
    
    // Remove keys related to parsing, cache, or documents
    const cacheKeys = keys.filter(key => 
      key.includes('parsed') || 
      key.includes('cache') || 
      key.includes('document') ||
      key.includes('parse') ||
      key.includes('import')
    )
    
    cacheKeys.forEach(key => {
      localStorage.removeItem(key)
      console.log('LocalStorage: Removed cache key:', key)
    })
    
    // Clear browser cache
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName)
          console.log('LocalStorage: Cleared browser cache:', cacheName)
        })
      })
    }
    
    console.log('LocalStorage: Parsing cache cleared successfully')
  } catch (error) {
    console.error('LocalStorage: Failed to clear parsing cache:', error)
  }
}

/**
 * Fix corrupted localStorage data
 * This function should be called if localStorage contains invalid data
 */
export function fixCorruptedLocalStorage(): void {
  try {
    const savedDocuments = localStorage.getItem(MANAGER_DOCUMENTS_KEY)
    if (savedDocuments === 'undefined' || savedDocuments === 'null' || savedDocuments === '') {
      localStorage.removeItem(MANAGER_DOCUMENTS_KEY)
      console.log('LocalStorage: Fixed corrupted data (undefined/null/empty)')
    } else if (savedDocuments) {
      try {
        const parsed = JSON.parse(savedDocuments)
        if (!Array.isArray(parsed)) {
          localStorage.removeItem(MANAGER_DOCUMENTS_KEY)
          console.log('LocalStorage: Fixed corrupted data (not an array)')
        }
      } catch {
        localStorage.removeItem(MANAGER_DOCUMENTS_KEY)
        console.log('LocalStorage: Fixed corrupted data (invalid JSON)')
      }
    }
  } catch (error) {
    console.error('LocalStorage: Failed to fix corrupted data:', error)
    localStorage.removeItem(MANAGER_DOCUMENTS_KEY)
  }
}
