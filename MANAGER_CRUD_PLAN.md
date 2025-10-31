# Manager CRUD Functions Implementation Plan

## Overview
Add full CRUD (Create, Read, Update, Delete) capabilities for managers AND owners on documents, tests, and assignments. Owner and manager share the same data (synchronized via `businessId` tenant isolation). The owner page should have the same management capabilities as the manager page.

## Current State Analysis

### ✅ Already Implemented
1. **Permissions**: Manager has CRUD permissions defined in `lib/auth.ts`
   - MATERIALS: create, read, update, delete
   - TESTS: create, read, update, delete  
   - ASSIGNMENTS: create, read, update, delete

2. **Data Synchronization**: APIs filter by `businessId` (tenant isolation)
   - `/api/documents` - filters by uploader's businessId
   - `/api/tests` - filters by creator's businessId
   - `/api/assignments` - filters by assigner's businessId

3. **API Endpoints**:
   - Documents: GET, POST, DELETE exist
   - Tests: GET, POST, PUT, DELETE exist
   - Assignments: GET, POST, PUT, DELETE exist

4. **UI Components**: 
   - `DocumentsPage`, `TestsPage`, `AssignmentsPage` components exist
   - Manager page displays data (read-only currently)
   - Owner page has overview, users, settings tabs but NO documents/tests/assignments tabs

### ❌ Missing/Incomplete
1. **Owner Permissions**: Owner only has 'read' permissions - needs CRUD like manager
2. **Permission Checks**: API endpoints don't verify role permissions
3. **Documents PUT**: No update endpoint for documents
4. **Owner Page**: Missing documents/tests/assignments tabs and CRUD handlers
5. **Manager Page Handlers**: CRUD handlers incomplete or missing
6. **Edit UI**: Edit functionality not wired up for tests/assignments
7. **Document Edit**: No edit capability for documents

---

## Implementation Plan

### Phase 1: Update Permissions & API Enforcement

#### 1.1 Update Owner Permissions

**File:** `lib/auth.ts`

**Current state:**
- Owner has only 'read' for MATERIALS, TESTS, ASSIGNMENTS
- Manager has full CRUD: 'create', 'read', 'update', 'delete'

**Change needed:**
Update owner permissions to match manager permissions:

```typescript
export const PERMISSIONS = {
  // Materials (Documents)
  MATERIALS: {
    owner: ['create', 'read', 'update', 'delete'] as const, // ADD CRUD
    manager: ['create', 'read', 'update', 'delete'] as const,
    employee: [] as const
  },
  
  // Tests/Modules
  TESTS: {
    owner: ['create', 'read', 'update', 'delete'] as const, // ADD CRUD
    manager: ['create', 'read', 'update', 'delete'] as const,
    employee: ['pass', 'read_own'] as const
  },
  
  // Assignments
  ASSIGNMENTS: {
    owner: ['create', 'read', 'update', 'delete'] as const, // ADD CRUD
    manager: ['create', 'read', 'update', 'delete'] as const,
    employee: ['read_own'] as const
  },
  // ... rest unchanged
}
```

#### 1.2 Add Permission Checks to API Endpoints

**Files to modify:**
- `app/api/documents/route.ts` (POST)
- `app/api/documents/[id]/route.ts` (DELETE)
- `app/api/tests/route.ts` (POST)
- `app/api/tests/[id]/route.ts` (PUT, DELETE)
- `app/api/assignments/route.ts` (POST)
- `app/api/assignments/[id]/route.ts` (PUT, DELETE)

**Changes:**
```typescript
// Add permission check helper
import { hasPermission } from '@/lib/auth'

// In each endpoint:
const session = await auth()
if (!session?.user?.id || !session?.user?.role) {
  return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
}

// Check permissions based on action
if (!hasPermission(session.user.role, 'MATERIALS', 'create')) {
  return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
}
```

**Resources to check:**
- POST `/api/documents` → `hasPermission(role, 'MATERIALS', 'create')`
- DELETE `/api/documents/[id]` → `hasPermission(role, 'MATERIALS', 'delete')`
- POST `/api/tests` → `hasPermission(role, 'TESTS', 'create')`
- PUT `/api/tests/[id]` → `hasPermission(role, 'TESTS', 'update')`
- DELETE `/api/tests/[id]` → `hasPermission(role, 'TESTS', 'delete')`
- POST `/api/assignments` → `hasPermission(role, 'ASSIGNMENTS', 'create')`
- PUT `/api/assignments/[id]` → `hasPermission(role, 'ASSIGNMENTS', 'update')`
- DELETE `/api/assignments/[id]` → `hasPermission(role, 'ASSIGNMENTS', 'delete')`

#### 1.2 Add Documents PUT Endpoint

**Create:** `app/api/documents/[id]/route.ts` (add PUT handler)

**Implementation:**
```typescript
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    
    if (!session?.user?.id || !session?.user?.role) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    
    if (!hasPermission(session.user.role, 'MATERIALS', 'update')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    
    const body = await request.json()
    const { title, originalFileName, fileType, status } = body
    
    // Verify document exists and belongs to same tenant
    const existingDoc = await db.select()
      .from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(and(
        eq(documents.id, id),
        eq(users.businessId, session.user.businessId)
      ))
      .limit(1)
    
    if (existingDoc.length === 0) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 })
    }
    
    // Update document
    const updateData: { updatedAt: Date; title?: string; originalFileName?: string; fileType?: string; status?: string } = {
      updatedAt: new Date()
    }
    if (title) updateData.title = title
    if (originalFileName) updateData.originalFileName = originalFileName
    if (fileType) updateData.fileType = fileType
    if (status) updateData.status = status
    
    await db.update(documents)
      .set(updateData)
      .where(eq(documents.id, id))
    
    return NextResponse.json({ success: true, message: 'Document updated successfully' })
  } catch (error) {
    // error handling
  }
}
```

---

### Phase 2: Owner Page - Add Manager Functions

#### 2.1 Add Documents, Tests, Assignments Tabs to Owner Page

**File:** `app/owner/page.tsx`

**Current state:**
- Has: Overview, Users, Settings tabs
- Missing: Documents, Tests, Assignments tabs

**Changes needed:**
1. Add new tabs to TabsList: "Documents", "Tests", "Assignments"
2. Import `DocumentsPage`, `TestsPage`, `AssignmentsPage` components
3. Add state for documents, tests (savedDocuments, savedTests)
4. Load tests data (currently only loads documents, assignments, users)
5. Add CRUD handlers for documents, tests, assignments
6. Add TabsContent sections for each new tab

**Implementation:**
```typescript
// Add to imports
import { DocumentsPage } from "@/components/pages/documents-page"
import { TestsPage } from "@/components/pages/tests-page"
import { AssignmentsPage } from "@/components/pages/assignments-page"

// Add state
const [savedTests, setSavedTests] = useState<SavedTest[]>([])

// Update loadData to load tests
const testsResponse = await fetch('/api/tests')
const testsResult = await testsResponse.json()
if (testsResult.success) {
  setSavedTests(testsResult.data.tests)
}

// Add CRUD handlers (see section 2.2)
```

#### 2.2 Add CRUD Handlers to Owner Page

**File:** `app/owner/page.tsx`

**Handlers to add:**
1. **Documents:**
   - `handleDeleteDocument` - Delete document
   - `handleEditDocument` - Navigate to edit
   - `handleViewDocument` - View document
   - `handleImportDocument` - Navigate to import

2. **Tests:**
   - `handleDeleteTest` - Delete test
   - `handleEditTest` - Navigate to test-builder with testId
   - `handleViewTest` - View test
   - `handleCreateTest` - Navigate to test-builder

3. **Assignments:**
   - `handleDeleteAssignment` - Delete assignment
   - `handleEditAssignment` - Navigate to assignment-builder with assignmentId
   - `handleViewAssignment` - View assignment
   - `handleCreateAssignment` - Navigate to assignment-builder

**Implementation pattern:**
```typescript
const handleDeleteDocument = async (id: string) => {
  if (!confirm('Are you sure you want to delete this document?')) return
  
  try {
    const response = await fetch(`/api/documents/${id}`, {
      method: 'DELETE'
    })
    const result = await response.json()
    
    if (result.success) {
      setSavedDocuments(prev => prev.filter(d => d.id !== id))
      await loadData() // Refresh data
    } else {
      alert(result.message || 'Failed to delete document')
    }
  } catch (error) {
    console.error('Error deleting document:', error)
    alert('Failed to delete document')
  }
}

const handleEditDocument = (id: string) => {
  // Open edit modal or navigate to edit page
  router.push(`/docs/import?edit=${id}`)
}

const handleViewDocument = (name: string) => {
  router.push(`/docs/${encodeURIComponent(name)}`)
}

const handleImportDocument = () => {
  router.push('/docs/import?returnTo=/owner?tab=docs')
}
```

#### 2.3 Add Tab Content Sections

**File:** `app/owner/page.tsx`

**Add after Settings TabsContent:**
```typescript
<TabsContent value="docs" className="space-y-3 md:space-y-6">
  <DocumentsPage
    documents={savedDocuments.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      uploadedAt: d.uploadedAt,
      size: d.size,
      status: d.status
    }))}
    onDeleteDocument={handleDeleteDocument}
    onViewDocument={handleViewDocument}
    onImportDocument={handleImportDocument}
  />
</TabsContent>

<TabsContent value="tests" className="space-y-3 md:space-y-6">
  <TestsPage
    tests={savedTests}
    onDeleteTest={handleDeleteTest}
    onViewTest={handleViewTest}
    onEditTest={handleEditTest}
  />
</TabsContent>

<TabsContent value="assignments" className="space-y-3 md:space-y-6">
  <AssignmentsPage
    assignments={savedAssignments.map(a => ({
      id: a.id,
      title: a.title || a.name,
      name: a.name,
      description: a.description,
      document: { id: 0, name: 'Document', type: 'DOCX', uploadedAt: a.createdAt },
      test: { id: a.testId || '', title: 'Test', questionCount: 0 },
      assignedUsers: [],
      dueDate: a.dueDate,
      createdAt: a.createdAt,
      createdBy: a.assignedBy,
      status: a.status
    }))}
    onDeleteAssignment={handleDeleteAssignment}
    onViewAssignment={handleViewAssignment}
    onEditAssignment={handleEditAssignment}
  />
</TabsContent>
```

---

### Phase 3: Manager Page CRUD Handlers (Still Needed)

#### 3.1 Complete Manager Page Handlers

**File:** `app/manager/page.tsx`

**Add/Missing handlers:**
1. **Documents:**
   - `handleDeleteDocument` ✅ (exists but needs API call)
   - `handleEditDocument` ❌ (missing)
   - `handleUpdateDocument` ❌ (missing)

2. **Tests:**
   - `handleDeleteTest` ✅ (exists but needs API call)
   - `handleEditTest` ✅ (exists - routes to test-builder)
   - `handleUpdateTest` ❌ (missing)

3. **Assignments:**
   - `handleDeleteAssignment` ✅ (exists but needs API call)
   - `handleEditAssignment` ✅ (exists - routes to assignment-builder)
   - `handleUpdateAssignment` ❌ (missing)

**Implementation pattern:**
```typescript
// Example: handleDeleteDocument
const handleDeleteDocument = async (id: string) => {
  if (!confirm('Are you sure you want to delete this document?')) return
  
  try {
    const response = await fetch(`/api/documents/${id}`, {
      method: 'DELETE'
    })
    const result = await response.json()
    
    if (result.success) {
      // Remove from local state
      setDocuments(prev => prev.filter(d => d.id !== id))
      // Remove from localStorage
      const saved = JSON.parse(localStorage.getItem('manager-documents') || '[]')
      localStorage.setItem('manager-documents', JSON.stringify(saved.filter((d: any) => d.id !== id)))
    } else {
      alert(result.message || 'Failed to delete document')
    }
  } catch (error) {
    console.error('Error deleting document:', error)
    alert('Failed to delete document')
  }
}
```

#### 2.2 Add Edit Modal/Forms

**Options:**
1. **Reuse existing builders** (recommended):
   - Edit document → `/docs/import` with pre-filled data
   - Edit test → `/test-builder` with test ID in query
   - Edit assignment → `/assignment-builder` with assignment ID in query

2. **Inline modals**:
   - Create edit modals in manager page for quick edits
   - Better UX but more code

**Recommendation:** Start with option 1, add modals later if needed.

#### 2.3 Update Data Loading

**Current:** Manager page loads data but handlers incomplete

**Changes needed:**
1. Ensure all handlers call APIs
2. Refresh data after mutations
3. Handle errors gracefully
4. Update localStorage sync

---

### Phase 4: Test & Assignment Builder Edit Mode

#### 4.1 Test Builder Edit Mode

**File:** `app/test-builder/page.tsx`

**Add:**
1. Check for `testId` query parameter
2. Load existing test data if `testId` present
3. Pre-fill form with test data
4. Change submit to PUT request if editing

**Implementation:**
```typescript
const searchParams = useSearchParams()
const testId = searchParams.get('testId')

useEffect(() => {
  if (testId) {
    // Load test data
    fetch(`/api/tests/${testId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Populate form fields
          setTestTitle(data.data.test.title)
          // ... populate all fields
        }
      })
  }
}, [testId])

const handleSubmit = async () => {
  if (testId) {
    // PUT request
    await fetch(`/api/tests/${testId}`, {
      method: 'PUT',
      body: JSON.stringify(testData)
    })
  } else {
    // POST request (create)
    await fetch('/api/tests', {
      method: 'POST',
      body: JSON.stringify(testData)
    })
  }
}
```

#### 4.2 Assignment Builder Edit Mode

**File:** `app/assignment-builder/page.tsx`

**Add:** Similar pattern to test builder
1. Check for `assignmentId` query parameter
2. Load existing assignment data
3. Pre-fill form
4. Submit as PUT if editing

---

### Phase 5: Document Edit Functionality

#### 5.1 Add Document Edit UI

**Options:**
1. **Simple title/status edit modal** in manager page
2. **Full edit via import page** with existing document ID

**Recommendation:** Start with option 1 (quick edit modal)

**Implementation:**
```typescript
// In manager page
const [editingDocument, setEditingDocument] = useState<string | null>(null)
const [documentEditForm, setDocumentEditForm] = useState({ title: '', status: '' })

const handleEditDocument = (id: string) => {
  const doc = documents.find(d => d.id === id)
  if (doc) {
    setEditingDocument(id)
    setDocumentEditForm({ title: doc.name, status: doc.status || 'ready' })
  }
}

const handleUpdateDocument = async () => {
  if (!editingDocument) return
  
  try {
    const response = await fetch(`/api/documents/${editingDocument}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(documentEditForm)
    })
    const result = await response.json()
    
    if (result.success) {
      // Refresh documents
      await loadData()
      setEditingDocument(null)
    }
  } catch (error) {
    console.error('Error updating document:', error)
  }
}
```

#### 5.2 Add Edit Modal Component

**Create or reuse:** Use existing Modal component from `@/components/common/modal`

---

### Phase 6: Testing & Validation

#### 6.1 Test Cases

**Documents CRUD:**
- ✅ Create document (via import flow)
- ✅ Read documents (list view)
- ✅ Update document (title, status)
- ✅ Delete document
- ✅ Permission checks (manager vs employee)
- ✅ Tenant isolation (owner/manager see same docs)

**Tests CRUD:**
- ✅ Create test
- ✅ Read tests
- ✅ Update test (all fields)
- ✅ Delete test (with assignment check)
- ✅ Permission checks
- ✅ Tenant isolation

**Assignments CRUD:**
- ✅ Create assignment
- ✅ Read assignments
- ✅ Update assignment (title, dueDate, assignedTo)
- ✅ Delete assignment
- ✅ Permission checks
- ✅ Tenant isolation

#### 6.2 Edge Cases

1. **Delete prevention:**
   - Document used in assignments → block deletion
   - Test used in assignments → block deletion
   - Show helpful error messages

2. **Concurrent edits:**
   - Handle optimistic updates
   - Show conflict warnings if needed

3. **Permission errors:**
   - Show clear error messages
   - Redirect unauthorized users

---

### Phase 7: UI/UX Enhancements

#### 7.1 Loading States
- Show loading indicators during API calls
- Disable buttons during mutations

#### 7.2 Success Feedback
- Toast notifications for successful operations
- Auto-refresh data after mutations

#### 7.3 Error Handling
- User-friendly error messages
- Retry mechanisms where appropriate

---

## Implementation Order

1. **Phase 1**: API permission checks (security first)
2. **Phase 2**: Owner page - add documents/tests/assignments tabs and CRUD handlers (priority - owner should have manager functions)
3. **Phase 3**: Manager page handlers (complete basic CRUD)
4. **Phase 4**: Builder edit modes (complete edit flow)
5. **Phase 5**: Document edit (if needed)
6. **Phase 6**: Testing
7. **Phase 7**: Polish

---

## Files to Create/Modify

### Create:
- None (reuse existing structure)

### Modify:
1. `app/api/documents/[id]/route.ts` - Add PUT handler
2. `app/api/documents/route.ts` - Add permission check
3. `app/api/documents/[id]/route.ts` - Add permission check to DELETE
4. `app/api/tests/route.ts` - Add permission check
5. `app/api/tests/[id]/route.ts` - Add permission checks to PUT/DELETE
6. `app/api/assignments/route.ts` - Add permission check
7. `app/api/assignments/[id]/route.ts` - Add permission checks to PUT/DELETE
8. `app/owner/page.tsx` - **Add documents/tests/assignments tabs and CRUD handlers** (PRIORITY)
9. `app/manager/page.tsx` - Complete CRUD handlers
10. `app/test-builder/page.tsx` - Add edit mode
11. `app/assignment-builder/page.tsx` - Add edit mode

---

## Success Criteria

✅ **Owner can create documents, tests, and assignments** (has manager functions)  
✅ **Owner can view all resources (synchronized with manager)**  
✅ **Owner can update documents, tests, and assignments**  
✅ **Owner can delete documents, tests, and assignments**  
✅ Manager can create documents, tests, and assignments  
✅ Manager can view all resources (synchronized with owner)  
✅ Manager can update documents, tests, and assignments  
✅ Manager can delete documents, tests, and assignments  
✅ Owner and manager see same data (tenant isolation works)  
✅ Permission checks prevent unauthorized actions  
✅ Error handling provides clear feedback  
✅ Edit flows work smoothly (via builders or modals)

---

## Notes

- **Data synchronization is automatic** via `businessId` filtering in APIs
- **Owner and manager share the same data** by design (same businessId)
- **No database changes needed** - existing schema supports this
- **Permission system already defined** - just needs to be enforced in APIs

