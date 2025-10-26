# Component Usage Guide

This document shows how to use the newly created global reusable components to maintain consistent UX/UI across the application.

## Quick Reference

### Layout Components

#### 1. Complete Page Layout
```tsx
import { PageLayout, ActionBar } from "@/components/common"

export default function UsersPage() {
  return (
    <PageLayout 
      title="Users"
      icon={<Users className="h-6 w-6" />}
    >
      <ActionBar
        primaryAction={{
          label: "Add User",
          onClick: () => router.push('/users/new'),
          icon: <Plus className="h-4 w-4" />
        }}
        secondaryActions={[
          { 
            label: "Import CSV", 
            onClick: handleImport,
            variant: "outline" 
          }
        ]}
      />
      
      {/* Your content */}
    </PageLayout>
  )
}
```

### Data Display Components

#### 2. Statistics Dashboard
```tsx
import { StatCard } from "@/components/common"

export function DashboardStats({ stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <StatCard
        title="Total Users"
        value={stats.totalUsers}
        subtitle="Active members"
        icon={<Users className="h-4 w-4" />}
        trend={{ value: 12, direction: "up", label: "this month" }}
      />
      <StatCard
        title="Completed Tests"
        value={stats.completedTests}
        subtitle="In the last 30 days"
        icon={<CheckCircle className="h-4 w-4" />}
        badge={{ label: "98%", variant: "default" }}
      />
      {/* More stats... */}
    </div>
  )
}
```

#### 3. Progress Metrics
```tsx
import { ProgressCard } from "@/components/common"

export function ProgressMetrics({ data }) {
  return (
    <ProgressCard
      title="Storage Usage"
      subtitle={`${data.used}GB of ${data.total}GB`}
      value={data.used}
      maxValue={data.total}
      unit="GB"
      showProgress
      trend="up"
      trendValue="+10GB"
    />
  )
}
```

### Form Components

#### 4. Form with Validation
```tsx
import { FormGroup, Modal } from "@/components/common"
import { Input, Textarea } from "@/components/ui/input"

export function CreateUserForm() {
  const [errors, setErrors] = useState({})
  
  return (
    <Modal
      title="Create New User"
      description="Add a new user to your organization"
      onConfirm={handleSubmit}
    >
      <FormGroup 
        label="Email" 
        required 
        error={errors.email}
        htmlFor="email"
      >
        <Input id="email" type="email" />
      </FormGroup>

      <FormGroup 
        label="Name" 
        required 
        error={errors.name}
        htmlFor="name"
      >
        <Input id="name" />
      </FormGroup>

      <FormGroup 
        label="Bio" 
        helpText="Optional description"
        htmlFor="bio"
      >
        <Textarea id="bio" rows={3} />
      </FormGroup>
    </Modal>
  )
}
```

### Search & Filter Components

#### 5. Advanced Search and Filtering
```tsx
import { SearchFilter, DataTable } from "@/components/common"

export function UsersPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  
  const columns = [
    { key: "name", label: "Name" },
    { 
      key: "status", 
      label: "Status",
      render: (value) => <StatusBadge status={value} />
    },
    { 
      key: "role", 
      label: "Role",
      render: (value) => <RoleBadge role={value} />
    }
  ]
  
  return (
    <div className="space-y-6">
      <SearchFilter
        searchValue={search}
        onSearchChange={setSearch}
        placeholder="Search users by name or email..."
        filters={[
          {
            name: "status",
            label: "Status",
            options: [
              { label: "All", value: "all" },
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" }
            ],
            value: statusFilter,
            onChange: setStatusFilter
          }
        ]}
        onReset={() => {
          setSearch("")
          setStatusFilter("all")
        }}
        showResetButton
      />
      
      <DataTable
        columns={columns}
        data={filteredUsers}
        onRowClick={(user) => router.push(`/users/${user.id}`)}
        emptyMessage="No users found"
      />
    </div>
  )
}
```

### Status and Feedback Components

#### 6. Status Indicators
```tsx
import { StatusIndicator, LoadingOverlay } from "@/components/common"

export function StatusExample() {
  return (
    <div className="space-y-4">
      <StatusIndicator 
        status="success" 
        label="Completed"
        size="md"
      />
      <StatusIndicator 
        status="loading" 
        label="Processing..."
      />
      <StatusIndicator 
        status="error" 
        label="Failed to save"
      />
    </div>
  )
}

// For full-page loading
export function LoadingExample() {
  return (
    <LoadingOverlay 
      isLoading={loading}
      message="Loading dashboard..."
      variant="overlay" // or 'inline' or 'fullscreen'
    />
  )
}
```

### Information Display Components

#### 7. Info Cards
```tsx
import { InfoCard } from "@/components/common"

export function DocumentInfo({ document }) {
  return (
    <InfoCard
      title={document.title}
      description={document.description}
      icon={<FileText className="h-5 w-5" />}
      badge={{ 
        label: document.status, 
        variant: "default" 
      }}
      alert={
        document.status === 'needs_review' 
          ? { message: "This document needs review", variant: "default" }
          : undefined
      }
      footer={
        <div className="flex gap-2">
          <Button variant="outline">Preview</Button>
          <Button>Edit</Button>
        </div>
      }
    >
      {/* Document details */}
    </InfoCard>
  )
}
```

### Management Pages

#### 8. Complete Management Interface
```tsx
import { ManagementPage } from "@/components/common"

export function DocumentsPage({ documents }) {
  const documentItems = documents.map(doc => ({
    id: doc.id,
    title: doc.name,
    subtitle: doc.uploadedAt,
    metadata: [doc.size, doc.type],
    badges: [{ label: doc.status, variant: "default" }],
    onClick: () => router.push(`/docs/${doc.id}`),
    onDelete: () => handleDelete(doc.id),
    onEdit: () => handleEdit(doc.id)
  }))

  return (
    <ManagementPage
      title="Documents"
      description="Manage your uploaded documents"
      icon={<FileText className="h-8 w-8" />}
      actionButton={{
        label: "Upload Document",
        icon: <Upload className="h-4 w-4" />,
        onClick: () => router.push('/docs/upload')
      }}
      items={documentItems}
      showEditButton={true}
      emptyState={{
        icon: <FileText className="h-12 w-12" />,
        title: "No documents yet",
        description: "Upload your first document",
        actionLabel: "Upload Document",
        onAction: () => router.push('/docs/upload')
      }}
    />
  )
}
```

### Action Bar Example

#### 9. Action Bar
```tsx
import { ActionBar } from "@/components/common"

export function ContentEditor() {
  return (
    <ActionBar
      primaryAction={{
        label: "Save Changes",
        onClick: handleSave,
        icon: <Save className="h-4 w-4" />
      }}
      secondaryActions={[
        { 
          label: "Preview", 
          onClick: showPreview,
          icon: <Eye className="h-4 w-4" />,
          variant: "outline"
        },
        { 
          label: "Cancel", 
          onClick: handleCancel,
          variant: "ghost"
        }
      ]}
    />
  )
}
```

## Real-World Examples

### Example 1: User Management Page
```tsx
import { 
  PageLayout, 
  SearchFilter, 
  DataTable, 
  ActionBar, 
  Modal 
} from "@/components/common"

export default function UsersPage() {
  // State management
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  
  // Table columns
  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { 
      key: "role", 
      label: "Role",
      render: (value) => <RoleBadge role={value} />
    },
    { 
      key: "status", 
      label: "Status",
      render: (value) => <StatusBadge status={value} />
    }
  ]
  
  return (
    <PageLayout title="Users" icon={<Users />}>
      {/* Search and Filters */}
      <SearchFilter
        searchValue={search}
        onSearchChange={setSearch}
        filters={[/* status filter */]}
      />
      
      {/* Action Bar */}
      <ActionBar
        primaryAction={{
          label: "Add User",
          onClick: () => setShowModal(true),
          icon: <Plus />
        }}
      />
      
      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredUsers}
        onRowClick={(user) => router.push(`/users/${user.id}`)}
      />
      
      {/* Create User Modal */}
      <Modal
        open={showModal}
        onOpenChange={setShowModal}
        title="Create User"
        onConfirm={handleCreate}
      >
        {/* Form fields */}
      </Modal>
    </PageLayout>
  )
}
```

### Example 2: Dashboard with Stats
```tsx
import { StatCard, ProgressCard, InfoCard } from "@/components/common"

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={stats.users}
          trend={{ value: 12, direction: "up" }}
        />
        <StatCard
          title="Completed Tests"
          value={stats.tests}
          badge={{ label: "98% pass rate" }}
        />
        <ProgressCard
          title="Storage"
          value={500}
          maxValue={1000}
          unit="GB"
          showProgress
        />
      </div>
      
      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InfoCard
          title="Recent Activity"
          icon={<Activity />}
        >
          {/* Activity feed */}
        </InfoCard>
        
        <InfoCard
          title="System Status"
          status="operational"
          badge={{ label: "All Systems Operational" }}
        >
          {/* System info */}
        </InfoCard>
      </div>
    </div>
  )
}
```

## Migration Checklist

When updating existing code to use these components:

- [ ] Replace loading spinners with `<LoadingOverlay />`
- [ ] Replace status displays with `<StatusIndicator />`
- [ ] Replace form field wrappers with `<FormGroup />`
- [ ] Replace search/filter UI with `<SearchFilter />`
- [ ] Replace action buttons with `<ActionBar />`
- [ ] Replace custom tables with `<DataTable />`
- [ ] Replace dialog wrappers with `<Modal />`
- [ ] Replace statistic displays with `<StatCard />` or `<ProgressCard />`
- [ ] Replace info displays with `<InfoCard />`

## Best Practices

1. **Always use these components** for common patterns
2. **Compose components** to build complex UI
3. **Maintain consistency** with existing props
4. **Test responsive** behavior
5. **Avoid duplicates** - check if a component already exists
6. **Follow TypeScript** type definitions strictly

## Component Props Reference

See `components/common/README.md` for detailed prop definitions and usage examples.

