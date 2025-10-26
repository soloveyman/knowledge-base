# Common Reusable Components

This directory contains globally reusable components that maintain consistent UX/UI patterns across the application.

## Components Overview

### Layout & Structure

#### `PageLayout`
Complete page wrapper with header and main content area.
```tsx
<PageLayout 
  title="My Page"
  icon={<Icon />}
  onClose={() => router.back()}
>
  {/* page content */}
</PageLayout>
```

#### `PageHeader`
Header component with icon and close button.
```tsx
<PageHeader 
  title="Section Title"
  icon={<Icon />}
  onClose={() => {}}
/>
```

#### `ManagementPage`
Pre-configured management page with list, empty state, and actions.
```tsx
<ManagementPage
  title="Users"
  description="Manage user accounts"
  icon={<Users />}
  actionButton={{ label: "Add User", onClick: () => {} }}
  items={userItems}
  emptyState={{ icon: <Users />, title: "No users", description: "..." }}
/>
```

### Cards & Information

#### `InfoCard`
Flexible card for displaying information with optional icon, badge, and alerts.
```tsx
<InfoCard
  title="Module Details"
  description="Learn about the module"
  icon={<FileText />}
  badge={{ label: "Published", variant: "default" }}
  alert={{ message: "Notice", variant: "default" }}
>
  {/* content */}
</InfoCard>
```

#### `StatCard`
Card for displaying statistics with trends.
```tsx
<StatCard
  title="Total Users"
  value="1,234"
  subtitle="Active members"
  icon={<Users />}
  trend={{ value: 12, direction: "up", label: "from last month" }}
/>
```

#### `ProgressCard`
Card showing progress bars and percentages.
```tsx
<ProgressCard
  title="Storage"
  subtitle="50% used"
  value={500}
  maxValue={1000}
  unit="GB"
  showProgress
  trend="up"
  trendValue="+50"
/>
```

#### `ManagementCard`
Container card with header, description, and action button.
```tsx
<ManagementCard
  title="Documents"
  description="Manage your files"
  icon={<FileText />}
  actionButton={{ label: "Upload", onClick: () => {}, icon: <Plus /> }}
>
  {/* content */}
</ManagementCard>
```

### Feedback & States

#### `EmptyState`
Empty state display with icon and optional action.
```tsx
<EmptyState
  icon={<FileText />}
  title="No documents"
  description="Upload your first document"
  actionLabel="Upload Now"
  onAction={() => {}}
/>
```

#### `ErrorMessage`
Error message display with optional icon.
```tsx
<ErrorMessage 
  error="Failed to load data"
  showIcon
/>
```

#### `DeleteConfirmation`
Confirmation dialog for delete actions.
```tsx
<DeleteConfirmation
  onConfirm={() => handleDelete()}
  itemName="Document"
  title="Delete Document"
  description="This action cannot be undone"
  trigger={<Button>Delete</Button>}
/>
```

#### `LoadingOverlay`
Loading state with different variants.
```tsx
<LoadingOverlay 
  isLoading={loading}
  message="Loading data..."
  variant="overlay" // 'inline' | 'overlay' | 'fullscreen'
/>
```

#### `StatusIndicator`
Status display with icon and optional label.
```tsx
<StatusIndicator
  status="success" // 'success' | 'error' | 'warning' | 'info' | 'pending' | 'loading'
  label="Completed"
  size="md"
/>
```

### Forms & Inputs

#### `FormGroup`
Form field wrapper with label, error, and help text.
```tsx
<FormGroup
  label="Email"
  htmlFor="email"
  required
  error={errors.email}
  helpText="Enter your email address"
>
  <Input id="email" />
</FormGroup>
```

#### `SearchFilter`
Search input with filters and reset button.
```tsx
<SearchFilter
  searchValue={search}
  onSearchChange={setSearch}
  placeholder="Search users..."
  filters={[
    { name: "status", label: "Status", options: [], value: "", onChange: () => {} }
  ]}
  onReset={() => {}}
  showResetButton
/>
```

### Actions & Toolbars

#### `ActionBar`
Set of action buttons (primary + secondary actions).
```tsx
<ActionBar
  primaryAction={{
    label: "Create",
    onClick: () => {},
    icon: <Plus />
  }}
  secondaryActions={[
    { label: "Import", onClick: () => {}, variant: "outline" },
    { label: "Export", onClick: () => {} }
  ]}
/>
```

#### `Toolbar`
Icon-only toolbar for editing actions.
```tsx
<Toolbar
  actions={[
    { icon: <Bold />, onClick: () => {}, tooltip: "Bold" },
    { icon: <Italic />, onClick: () => {}, tooltip: "Italic" }
  ]}
/>
```

### Lists & Data

#### `ListItem`
Standard list item with title, subtitle, metadata, badges, and actions.
```tsx
<ListItem
  title="Document Name"
  subtitle="Last modified yesterday"
  metadata={["Size: 2.4 MB", "Type: PDF"]}
  badges={[{ label: "Published", variant: "default" }]}
  onClick={() => view(id)}
  onDelete={() => delete(id)}
  onEdit={() => edit(id)}
  showEditButton
/>
```

#### `DataTable`
Table component with column definitions.
```tsx
<DataTable
  columns={[
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { 
      key: "status", 
      label: "Status",
      render: (value) => <Badge>{value}</Badge>
    }
  ]}
  data={users}
  onRowClick={(row) => viewDetail(row)}
  emptyMessage="No users found"
/>
```

### Badge Helpers

Badge utilities are available from `@/lib/badges`:
- `StatusBadge` - Status indicators
- `RoleBadge` - User roles
- `DifficultyBadge` - Difficulty levels
- `PlanBadge` - Subscription plans
- And more...

## Usage Patterns

### Consistent Spacing
All components use Tailwind's spacing scale. Use `gap-4`, `space-y-4`, etc.

### Consistent Colors
- Primary: `bg-blue-600`, `text-blue-600`
- Success: `bg-green-600`, `text-green-600`
- Warning: `bg-yellow-600`, `text-yellow-600`
- Error: `bg-red-600`, `text-red-600`
- Neutral: `bg-gray-600`, `text-gray-600`

### Responsive Design
- Use `sm:`, `md:`, `lg:` breakpoints
- Most components are mobile-first
- Flex layouts adapt automatically

## Best Practices

1. **Always use these components** instead of creating new ones for common patterns
2. **Compose components** to create more complex UI
3. **Maintain consistency** with existing styles and props
4. **Test responsive behavior** on different screen sizes
5. **Avoid inline styles** - use Tailwind classes
6. **Pass proper types** for all props

## Migration Guide

When refactoring existing code:

1. Replace manual status displays with `<StatusIndicator />`
2. Replace loading spinners with `<LoadingOverlay />`
3. Replace form field wrappers with `<FormGroup />`
4. Replace custom search/filter UI with `<SearchFilter />`
5. Replace manual action buttons with `<ActionBar />`
6. Replace custom tables with `<DataTable />`

This will ensure consistent UX across the entire application.

