# Owner Page Tabs Implementation Plan

## Overview
Add docs, tests, and assignments tabs to the owner page with the same working pattern and behavior as the manager page, and synchronize tab state between both pages.

## Current State Analysis

### Manager Page (Reference Implementation)
- **Tabs**: overview, docs, tests, assignments (4 tabs)
- **URL State**: Uses `?tab=` query parameter with `getTabFromUrl()`
- **LocalStorage**: 
  - `manager-documents` - persists documents
  - `manager-tests` - persists tests
  - `manager-assignments` - persists assignments
- **State Management**:
  - Initializes state from localStorage to prevent empty states on re-mount
  - Debug wrappers for setState (setDocumentsWithLog, setSavedTestsWithLog, setSavedAssignmentsWithLog)
  - Tab-based data reloading with `useEffect` hooks
- **Components**: 
  - Inline docs content (Card-based list)
  - `TestsPage` component
  - `AssignmentsPage` component
- **Synchronization**: Uses `saveCurrentTab()` and `getTabFromUrl()` from `redirect-utils.ts`

### Owner Page (Current State)
- **Tabs**: overview, users, settings (3 tabs)
- **URL State**: Hardcoded `defaultValue="overview"` (no URL param support)
- **LocalStorage**: None
- **State Management**: Basic `useState` without persistence
- **Components**: 
  - `UsersPage` component
  - Inline overview and settings content
- **Missing**: No docs, tests, assignments tabs

---

## Implementation Plan

### Phase 1: Update redirect-utils.ts for Owner Tabs

**File**: `lib/redirect-utils.ts`

**Changes**:
1. Update `ROLE_TAB_MAPPINGS.owner.tabs` to include new tabs:
   ```typescript
   owner: {
     defaultTab: 'overview',
     tabs: ['overview', 'users', 'docs', 'tests', 'assignments', 'settings']
   }
   ```

---

### Phase 2: Add State Management to Owner Page

**File**: `app/owner/page.tsx`

**Changes**:

#### 2.1 Add Missing Imports
```typescript
import { useSearchParams } from "next/navigation"
import { Suspense, useMemo, useLayoutEffect } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { DeleteConfirmation } from "@/components/common/delete-confirmation"
import { TestsPage } from "@/components/pages/tests-page"
import { AssignmentsPage } from "@/components/pages/assignments-page"
import { DocumentsPage } from "@/components/pages/documents-page"
import { X, FileText } from "lucide-react"
import { saveCurrentTab, getTabFromUrl } from "@/lib/redirect-utils"
import { cleanupDocumentFromLocalStorage, syncLocalStorageWithDatabase, fixCorruptedLocalStorage } from "@/lib/localStorage-utils"
```

#### 2.2 Add Missing Interfaces
- `SavedTest` interface (same as manager page)
- `AssignedUser` interface (same as manager page)
- Update `SavedDocument` interface to match manager's document format

#### 2.3 Add State Initialization from LocalStorage
- Initialize `documents` from `localStorage.getItem('owner-documents')`
- Initialize `savedTests` from `localStorage.getItem('owner-tests')`
- Initialize `savedAssignments` from `localStorage.getItem('owner-assignments')`

#### 2.4 Add Debug Wrappers (Optional but Recommended)
- `setDocumentsWithLog` - logs and saves to localStorage
- `setSavedTestsWithLog` - logs and saves to localStorage
- `setSavedAssignmentsWithLog` - logs and saves to localStorage

#### 2.5 Add Loading States
- `isLoadingDocuments`
- `isLoadingTests`
- `isLoadingAssignments`

---

### Phase 3: Implement URL Tab State Management

**File**: `app/owner/page.tsx`

**Changes**:

#### 3.1 Add URL Tab Support
```typescript
const searchParams = useSearchParams()

const defaultTab = useMemo(() => {
  const tab = getTabFromUrl(searchParams)
  return tab && ['overview', 'users', 'docs', 'tests', 'assignments', 'settings'].includes(tab) 
    ? tab 
    : "overview"
}, [searchParams])

useEffect(() => {
  if (defaultTab) {
    saveCurrentTab('owner', defaultTab)
  }
}, [defaultTab])
```

#### 3.2 Update Tabs Component
- Change `defaultValue="overview"` to `defaultValue={defaultTab}`
- Add new TabsTrigger components for docs, tests, assignments
- Update TabsList grid to accommodate 6 tabs (grid-cols-6 or responsive)

---

### Phase 4: Add Data Loading Functions

**File**: `app/owner/page.tsx`

**Changes**:

#### 4.1 Update `loadData` Function
Add loading for tests:
```typescript
// Load tests
const testsResponse = await fetch('/api/tests')
const testsResult = await testsResponse.json()
if (testsResult.success) {
  setSavedTestsWithLog(testsResult.data.tests)
}
```

Transform documents to match format (same as manager):
```typescript
const transformedDocs = documentsResult.data.documents.map((doc) => ({
  id: doc.id,
  name: doc.originalFileName || doc.title,
  type: doc.fileType?.toUpperCase() || 'UNKNOWN',
  uploadedAt: new Date(doc.createdAt).toLocaleDateString(),
  size: doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown',
  status: doc.status || 'ready'
}))
setDocumentsWithLog(transformedDocs)
syncLocalStorageWithDatabase(transformedDocs)
```

#### 4.2 Add Tab-Based Data Reloading
```typescript
// Reload data when tab changes to docs
useEffect(() => {
  if (defaultTab === 'docs') {
    setTimeout(() => loadData(true), 0)
  }
}, [defaultTab, loadData])

// Reload data when tab changes to tests
useEffect(() => {
  if (defaultTab === 'tests') {
    setTimeout(() => loadData(true), 0)
  }
}, [defaultTab, loadData])

// Reload data when tab changes to assignments
useEffect(() => {
  if (defaultTab === 'assignments') {
    setTimeout(() => loadData(true), 0)
  }
}, [defaultTab, loadData])
```

#### 4.3 Add Visibility/Focus Reloading
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (!document.hidden && ['docs', 'tests', 'assignments', 'overview'].includes(defaultTab)) {
      setTimeout(() => loadData(true), 0)
    }
  }
  const handleFocus = () => {
    if (['docs', 'tests', 'assignments', 'overview'].includes(defaultTab)) {
      setTimeout(() => loadData(true), 0)
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleFocus)
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', handleFocus)
  }
}, [defaultTab, loadData])
```

---

### Phase 5: Add Handler Functions with Full CRUD Integration

**File**: `app/owner/page.tsx`

**Changes**:

#### 5.1 Document Handlers (CRUD)
```typescript
// DELETE - Remove document
const handleDeleteDocument = async (id: string) => {
  try {
    const response = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    const result = await response.json()
    if (result.success) {
      setDocumentsWithLog(documents.filter(doc => doc.id !== id))
      cleanupDocumentFromLocalStorage(id)
      router.push('/owner?tab=docs')
    } else {
      alert(result.message || 'Failed to delete document')
    }
  } catch (error) {
    console.error('Error deleting document:', error)
    alert('Error deleting document')
  }
}

// READ - View document (routes to document viewer)
const handleViewDocument = (name: string) => {
  // Routes to document viewer: /docs/[filename]
  // Document viewer will navigate back to /owner?tab=docs using useNavigateBack()
  router.push(`/docs/${encodeURIComponent(name)}`)
}

// CREATE - Import new document (routes to import page)
const handleImportDocument = () => {
  // IMPORTANT: returnTo must include owner page and docs tab for proper navigation back
  router.push('/docs/import?returnTo=/owner?tab=docs')
}

// UPDATE - Edit document metadata (if needed in future)
// Note: Document editing may be done via import page or separate edit modal
const handleEditDocument = (id: string) => {
  // Future: Can route to import page with document ID for re-import/edit
  // Or open inline edit modal
  // For now, documents may not need edit functionality
  console.log('Edit document:', id)
}
```

#### 5.2 Test Handlers (CRUD)
```typescript
// DELETE - Remove test
const handleDeleteTest = async (id: string) => {
  try {
    const response = await fetch(`/api/tests/${id}`, { method: 'DELETE' })
    const result = await response.json()
    if (result.success) {
      setSavedTestsWithLog(savedTests.filter(t => t.id !== id))
      // Reload data to ensure consistency
      setTimeout(() => loadData(true), 0)
    } else {
      alert(result.message || 'Failed to delete test')
    }
  } catch (error) {
    console.error('Error deleting test:', error)
    alert('Error deleting test')
  }
}

// READ - View test details
const handleViewTest = (id: string) => {
  // Route to test viewer or test session page
  router.push(`/test/${id}`)
}

// UPDATE - Edit test (routes to test builder in edit mode)
const handleEditTest = (id: string) => {
  // Routes to test-builder with edit parameter
  // Test builder should detect ?edit=id and load existing test data
  router.push(`/test-builder?edit=${id}&returnTo=/owner?tab=tests`)
}

// CREATE - Create new test (handled by TestsPage component actionButton)
// The TestsPage component already routes to /test-builder via actionButton
// But we should ensure returnTo is set for proper navigation back
```

#### 5.3 Assignment Handlers (CRUD)
```typescript
// DELETE - Remove assignment
const handleDeleteAssignment = async (id: string) => {
  try {
    const response = await fetch(`/api/assignments/${id}`, { method: 'DELETE' })
    const result = await response.json()
    if (result.success) {
      setSavedAssignmentsWithLog(savedAssignments.filter(a => a.id !== id))
      // Reload data to ensure consistency
      setTimeout(() => loadData(true), 0)
    } else {
      alert(result.message || 'Failed to delete assignment')
    }
  } catch (error) {
    console.error('Error deleting assignment:', error)
    alert('Error deleting assignment')
  }
}

// READ - View assignment details
const handleViewAssignment = (id: string) => {
  // Route to assignment viewer or details page
  router.push(`/assignment/${id}`)
}

// UPDATE - Edit assignment (routes to assignment builder in edit mode)
const handleEditAssignment = (id: string) => {
  // Routes to assignment-builder with edit parameter
  // Assignment builder should detect ?edit=id and load existing assignment data
  router.push(`/assignment-builder?edit=${id}&returnTo=/owner?tab=assignments`)
}

// CREATE - Create new assignment (handled by AssignmentsPage component actionButton)
// The AssignmentsPage component already routes to /assignment-builder via actionButton
// But we should ensure returnTo is set for proper navigation back
```

---

### Phase 6: Add Tab Content Components

**File**: `app/owner/page.tsx`

**Changes**:

#### 6.1 Documents Tab Content (with Import Integration)
Add after existing TabsContent for users:
```typescript
<TabsContent value="docs" className="space-y-3 md:space-y-6">
  <DocumentsPage
    documents={documents.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      uploadedAt: d.uploadedAt,
      size: d.size,
      status: d.status
    }))}
    onDeleteDocument={handleDeleteDocument}
    onViewDocument={handleViewDocument}
    onImportDocument={handleImportDocument} // IMPORTANT: Routes to /docs/import with returnTo
    isLoading={isLoadingDocuments}
  />
</TabsContent>
```

**Note**: DocumentsPage component has built-in:
- **Import button** → Calls `onImportDocument` → Routes to `/docs/import?returnTo=/owner?tab=docs`
- **Delete button** → Calls `onDeleteDocument` → Deletes via API
- **View/Click** → Calls `onViewDocument` → Routes to `/docs/[name]` (document viewer)
  - Document viewer supports: PDF (iframe), DOCX (formatted text), XLSX (tables)
  - Document viewer uses `useNavigateBack()` to return to `/owner?tab=docs`
  - Document viewer displays: document content, tables, formatted text using `renderFormattedText()`

#### 6.2 Tests Tab Content (with Test Builder Integration)
```typescript
<TabsContent value="tests" className="space-y-3 md:space-y-6">
  <TestsPage
    tests={savedTests}
    onDeleteTest={handleDeleteTest}
    onViewTest={handleViewTest}
    onEditTest={handleEditTest} // IMPORTANT: Routes to /test-builder?edit=${id}&returnTo=/owner?tab=tests
    isLoading={isLoadingTests}
  />
</TabsContent>
```

**Note**: TestsPage component has built-in:
- **Create button** → Routes to `/test-builder` (should be updated to include returnTo)
- **Edit button** → Calls `onEditTest` → Routes to `/test-builder?edit=${id}&returnTo=/owner?tab=tests`
- **Delete button** → Calls `onDeleteTest` → Deletes via API
- **View/Click** → Calls `onViewTest` → Routes to `/test/${id}`

#### 6.3 Assignments Tab Content (with Assignment Builder Integration)
```typescript
<TabsContent value="assignments" className="space-y-3 md:space-y-6">
  <AssignmentsPage
    assignments={savedAssignments.map(a => ({
      id: a.id,
      name: `Assignment ${a.id.slice(0, 8)}`,
      title: a.title || `Assignment ${a.id.slice(0, 8)}`,
      description: '',
      document: { id: 0, name: 'Document', type: 'DOCX', uploadedAt: a.createdAt },
      test: { id: a.testId, title: 'Test', questionCount: 0 },
      assignedUsers: [],
      dueDate: a.dueDate,
      createdAt: a.createdAt,
      createdBy: a.assignedBy || a.createdBy,
      status: a.status
    }))}
    onDeleteAssignment={handleDeleteAssignment}
    onViewAssignment={handleViewAssignment}
    onEditAssignment={handleEditAssignment} // IMPORTANT: Routes to /assignment-builder?edit=${id}&returnTo=/owner?tab=assignments
    isLoading={isLoadingAssignments}
  />
</TabsContent>
```

**Note**: AssignmentsPage component has built-in:
- **Create button** → Routes to `/assignment-builder` (should be updated to include returnTo)
- **Edit button** → Calls `onEditAssignment` → Routes to `/assignment-builder?edit=${id}&returnTo=/owner?tab=assignments`
- **Delete button** → Calls `onDeleteAssignment` → Deletes via API
- **View/Click** → Calls `onViewAssignment` → Routes to `/assignment/${id}`

#### 6.4 Update TabsList
```typescript
<TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
  <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
  <TabsTrigger value="users">{t('users')}</TabsTrigger>
  <TabsTrigger value="docs">{t('documents')}</TabsTrigger>
  <TabsTrigger value="tests">{t('tests')}</TabsTrigger>
  <TabsTrigger value="assignments">{t('assignments')}</TabsTrigger>
  <TabsTrigger value="settings">{t('settings')}</TabsTrigger>
</TabsList>
```

---

### Phase 7: Update Overview Tab

**File**: `app/owner/page.tsx`

**Changes**:

#### 7.1 Add Tests Count to Overview Metrics
Update the metrics cards to include tests count (if not already present).

#### 7.2 Update UserProgressReport
Ensure `UserProgressReport` receives tests data:
```typescript
<UserProgressReport 
  users={savedUsers} 
  assignments={savedAssignments.map(/* transform */)}
  modules={documents.map(d => ({ id: String(d.id), title: d.name }))}
  tests={savedTests.map(t => ({ id: t.id, title: t.title }))}
/>
```

---

### Phase 8: Update localStorage-utils.ts (Optional)

**File**: `lib/localStorage-utils.ts`

**Changes**:
If we want owner-specific localStorage keys (recommended for separation):
- Add `OWNER_DOCUMENTS_KEY = 'owner-documents'`
- Update functions to accept a key parameter OR create owner-specific versions
- Alternatively, keep manager-specific functions and create owner-specific ones

**OR** (Simpler approach):
- Keep using manager localStorage functions but with different keys
- Store owner data separately: `owner-documents`, `owner-tests`, `owner-assignments`

---

### Phase 8.1: Verify Builder Pages Support Edit Mode

**Files**: `app/test-builder/page.tsx`, `app/assignment-builder/page.tsx`, `app/docs/import/page.tsx`

**Verification Steps**:
1. **Test Builder** should support `?edit=${id}` query parameter:
   - Load existing test data when `edit` param is present
   - Pre-fill form fields
   - Change submit to PUT request instead of POST
   - Handle returnTo navigation back to owner page

2. **Assignment Builder** should support `?edit=${id}` query parameter:
   - Load existing assignment data when `edit` param is present
   - Pre-fill form fields
   - Change submit to PUT request instead of POST
   - Handle returnTo navigation back to owner page

3. **Document Import Page** should support `returnTo` parameter:
   - After successful import, navigate back to `returnTo` URL
   - Should preserve tab state: `/owner?tab=docs`

### Phase 8.2: Verify Document Viewer Integration

**File**: `app/docs/[filename]/page.tsx`

**Verification Steps**:
1. **Document Viewer** should support navigation back:
   - Uses `useNavigateBack()` from `redirect-utils.ts`
   - Detects user role from session
   - Returns to `/owner?tab=docs` when role is 'owner'
   - Returns to `/manager?tab=docs` when role is 'manager'
   - Returns to previous tab when role is 'employee'

2. **Document Viewer** should support all document types:
   - **PDF**: Displays in iframe via `/api/documents/${filename}`
   - **DOCX**: Displays formatted text content using `renderFormattedText()`
   - **XLSX**: Displays tables using `renderTablesAsHTML()`
   - Handles parsed content from database (sections, tables)

3. **Document Viewer** features:
   - Loads document by filename from `/api/documents`
   - Extracts content from `parsedContent.sections` (DOCX)
   - Extracts tables from `parsedContent.tables` (XLSX)
   - Cleans artifacts (removes numbering artifacts while preserving lists)
   - Shows loading state while fetching
   - Handles errors and redirects back on failure

**If document viewer needs updates for owner navigation**:
```typescript
// In app/docs/[filename]/page.tsx
const handleClose = () => {
  const userRole = (session?.user as UserWithRole)?.role || 'manager'
  // Ensure owner returns to owner page with docs tab
  if (userRole === 'owner') {
    router.push('/owner?tab=docs')
  } else {
    navigateBack(userRole as 'employee' | 'manager' | 'owner', 'docs')
  }
}
```

**Document Viewer Routes**:
- `/docs/[filename]` - Main document viewer (used by owner/manager)
- `/read/[documentId]` - Document reader for assignments (used by employees)

**Both routes should:**
- Support navigation back using `useNavigateBack()`
- Detect user role and navigate to appropriate page
- Preserve tab state via URL parameters

**If builders don't support edit mode, add**:
```typescript
// In test-builder/page.tsx
const searchParams = useSearchParams()
const editTestId = searchParams.get('edit')
const returnTo = searchParams.get('returnTo') || '/owner'

useEffect(() => {
  if (editTestId) {
    // Load test data
    fetch(`/api/tests/${editTestId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Pre-fill form with test data
          setTestTitle(data.data.test.title)
          // ... populate all fields
        }
      })
  }
}, [editTestId])

const handleSubmit = async () => {
  if (editTestId) {
    // PUT request for update
    await fetch(`/api/tests/${editTestId}`, {
      method: 'PUT',
      body: JSON.stringify(testData)
    })
  } else {
    // POST request for create
    await fetch('/api/tests', {
      method: 'POST',
      body: JSON.stringify(testData)
    })
  }
  // Navigate back
  router.push(returnTo)
}
```

---

### Phase 9: Wrap Component in Suspense

**File**: `app/owner/page.tsx`

**Changes**:

#### 9.1 Split Component
Create `OwnerPageInner` component (like `ManagerPageInner`) and wrap in Suspense:
```typescript
export default function OwnerPage() {
  return (
    <Suspense fallback={/* loading */}>
      <OwnerPageInner />
    </Suspense>
  )
}
```

---

### Phase 10: Tab Synchronization (Optional Enhancement)

**File**: `lib/redirect-utils.ts` or create new `lib/tab-sync.ts`

**Changes**:
If we want to synchronize tabs between owner and manager:
1. Create a shared tab state in localStorage/sessionStorage
2. When switching between owner/manager pages, preserve the tab type (e.g., if on manager/docs, switch to owner/docs)
3. This would require:
   - A mapping between roles and tab names
   - Intercepting navigation between role pages
   - Restoring the equivalent tab on the new page

**Note**: This is optional and may not be necessary. The current implementation already syncs tabs via URL params.

---

## Implementation Checklist

### Core Functionality
- [ ] Update `redirect-utils.ts` with owner tabs
- [ ] Add imports to owner page
- [ ] Add interfaces (SavedTest, AssignedUser, etc.)
- [ ] Add state initialization from localStorage
- [ ] Add URL tab state management (`useSearchParams`, `getTabFromUrl`)
- [ ] Add debug wrappers for setState (optional)
- [ ] Update `loadData` to include tests and transform documents
- [ ] Add tab-based data reloading effects
- [ ] Add visibility/focus reloading effects
- [ ] Add document handlers (delete, view, import)
- [ ] Add test handlers (delete, view, edit)
- [ ] Add assignment handlers (delete, view, edit)
- [ ] Add Documents tab content
- [ ] Add Tests tab content
- [ ] Add Assignments tab content
- [ ] Update TabsList with all 6 tabs
- [ ] Update Overview tab metrics
- [ ] Wrap in Suspense component
- [ ] Test tab switching
- [ ] Test data persistence
- [ ] Test handlers functionality

### CRUD Integration & Builders
- [ ] Verify document import returns to owner page with correct tab
- [ ] Verify test builder supports edit mode (`?edit=${id}`)
- [ ] Verify assignment builder supports edit mode (`?edit=${id}`)
- [ ] Ensure all builders include `returnTo` parameter for navigation
- [ ] Test create new document (import flow)
- [ ] Test create new test (test-builder flow)
- [ ] Test create new assignment (assignment-builder flow)
- [ ] Test edit existing test (test-builder edit flow)
- [ ] Test edit existing assignment (assignment-builder edit flow)
- [ ] Test delete document
- [ ] Test delete test
- [ ] Test delete assignment
- [ ] Verify data refreshes after create/edit/delete operations
- [ ] Test navigation back from builders maintains tab state

### Document Viewer Integration
- [ ] Verify document viewer routes to `/docs/[filename]` correctly
- [ ] Verify document viewer supports PDF display (iframe)
- [ ] Verify document viewer supports DOCX display (formatted text)
- [ ] Verify document viewer supports XLSX display (tables)
- [ ] Verify document viewer uses `useNavigateBack()` for navigation back
- [ ] Verify document viewer returns to `/owner?tab=docs` for owner role
- [ ] Test document viewer loads document content from database
- [ ] Test document viewer extracts sections and tables correctly
- [ ] Test document viewer handles errors and redirects back
- [ ] Test navigation flow: Owner page → View document → Back to owner page (docs tab)
- [ ] Verify document viewer displays parsed content correctly
- [ ] Test document viewer with different file types (PDF, DOCX, XLSX)

### Synchronization
- [ ] Verify URL params work (`?tab=docs`)
- [ ] Verify tab state persists via `saveCurrentTab()`
- [ ] Test navigation between owner and manager pages
- [ ] Verify returnTo URLs preserve tab state correctly
- [ ] (Optional) Implement cross-role tab synchronization

### Testing
- [ ] Test all tabs render correctly
- [ ] Test data loading on tab switch
- [ ] Test handlers (delete, view, edit, import)
- [ ] Test localStorage persistence
- [ ] Test URL parameter tab state
- [ ] Test browser back/forward with tabs
- [ ] Test full CRUD cycle: Create → View → Edit → Delete
- [ ] Test navigation flow: Owner page → Builder → Save → Return to Owner page

---

## File Changes Summary

### Files to Modify
1. `lib/redirect-utils.ts` - Add owner tabs to ROLE_TAB_MAPPINGS
2. `app/owner/page.tsx` - Major refactor to match manager page pattern
3. `lib/localStorage-utils.ts` - (Optional) Add owner-specific keys

### Files to Reference (No Changes)
- `app/manager/page.tsx` - Reference implementation
- `components/pages/documents-page.tsx` - Reuse component
- `components/pages/tests-page.tsx` - Reuse component
- `components/pages/assignments-page.tsx` - Reuse component
- `app/docs/[filename]/page.tsx` - Document viewer (verify navigation back)
- `app/read/[documentId]/page.tsx` - Assignment document reader
- `lib/content-renderer.tsx` - Text formatting utilities

---

## Notes

1. **Pattern Consistency**: Follow manager page patterns exactly for consistency
2. **LocalStorage Keys**: Use `owner-*` prefix to separate from manager data
3. **URL State**: Always use URL params for tab state, not just component state
4. **Data Reloading**: Reload data when tab changes, page becomes visible, or window gets focus
5. **Error Handling**: Include try/catch in all handlers with user feedback
6. **Loading States**: Show loading indicators during data fetch
7. **Empty States**: Use EmptyState component for empty data sets
8. **CRUD Integration**: All builders (test-builder, assignment-builder, document-import) must:
   - Support `returnTo` query parameter for navigation back
   - Include tab state in returnTo URL (e.g., `/owner?tab=tests`)
   - Test builder and assignment builder must support `?edit=${id}` for edit mode
   - After create/edit/delete, reload data to show changes
9. **Navigation Flow**:
   - Owner page (docs tab) → Import document → Returns to `/owner?tab=docs`
   - Owner page (docs tab) → View document → Document viewer → Back button → Returns to `/owner?tab=docs`
   - Owner page (tests tab) → Create/Edit test → Returns to `/owner?tab=tests`
   - Owner page (assignments tab) → Create/Edit assignment → Returns to `/owner?tab=assignments`
10. **Document Viewer Integration**:
   - Document viewer route: `/docs/[filename]`
   - Supports PDF (iframe), DOCX (formatted text), XLSX (tables)
   - Uses `useNavigateBack()` to return to previous page with correct tab
   - For owner role: returns to `/owner?tab=docs`
   - Loads document data from `/api/documents` API
   - Displays parsed content (sections, tables) from database
   - Uses `renderFormattedText()` for text formatting
   - Uses `renderTablesAsHTML()` for table rendering

---

## Estimated Implementation Time
- Phase 1-2: 30 min (state management setup)
- Phase 3: 15 min (URL tab support)
- Phase 4: 30 min (data loading)
- Phase 5: 30 min (handlers)
- Phase 6: 20 min (tab content)
- Phase 7: 15 min (overview updates)
- Phase 8: 15 min (localStorage utils if needed)
- Phase 8.1: 20 min (builder verification)
- Phase 8.2: 15 min (document viewer verification)
- Phase 9: 10 min (Suspense wrapper)
- Phase 10: 30 min (optional sync)
- Testing: 45 min (includes document viewer testing)

**Total: ~4-5 hours** (includes CRUD integration, builder verification, and document viewer integration)

