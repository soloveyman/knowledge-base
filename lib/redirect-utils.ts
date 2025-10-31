import { useRouter } from "next/navigation"

// Define the role-based tab mappings
const ROLE_TAB_MAPPINGS = {
  employee: {
    defaultTab: 'overview',
    tabs: ['overview', 'assignments', 'progress']
  },
  manager: {
    defaultTab: 'overview', 
    tabs: ['overview', 'docs', 'tests', 'assignments']
  },
  owner: {
    defaultTab: 'overview',
    tabs: ['overview', 'users', 'docs', 'tests', 'assignments', 'settings']
  }
} as const

type UserRole = keyof typeof ROLE_TAB_MAPPINGS

// Helper function to check if a tab is valid for a role
function isValidTabForRole(role: UserRole, tab: string): tab is string {
  const validTabs = ROLE_TAB_MAPPINGS[role].tabs
  return validTabs.includes(tab as never)
}

// Hook for navigation with router
export function useNavigateBack() {
  const router = useRouter()
  
  return (role: UserRole, fallbackTab?: string) => {
    const redirectUrl = getRedirectUrl(role, fallbackTab)
    router.push(redirectUrl)
  }
}

// Get the previous tab from sessionStorage or default to the role's default tab
export function getPreviousTab(role: UserRole): string {
  if (typeof window === 'undefined') {
    return ROLE_TAB_MAPPINGS[role].defaultTab
  }
  
  const storedTab = sessionStorage.getItem(`previousTab_${role}`)
  
  if (storedTab && isValidTabForRole(role, storedTab)) {
    return storedTab
  }
  
  return ROLE_TAB_MAPPINGS[role].defaultTab
}

// Save the current tab to sessionStorage
export function saveCurrentTab(role: UserRole, tab: string) {
  if (typeof window === 'undefined') return
  
  if (isValidTabForRole(role, tab)) {
    sessionStorage.setItem(`previousTab_${role}`, tab)
  }
}

// Get the appropriate redirect URL based on role and previous tab
export function getRedirectUrl(role: UserRole, fallbackTab?: string): string {
  const tab = fallbackTab || getPreviousTab(role)
  return `/${role}?tab=${tab}`
}

// Extract tab from URL search params
export function getTabFromUrl(searchParams: URLSearchParams): string | null {
  return searchParams.get('tab')
}

// Check if a tab is valid for a given role
export function isValidTab(role: UserRole, tab: string): boolean {
  return isValidTabForRole(role, tab)
}

// Get the default tab for a role
export function getDefaultTab(role: UserRole): string {
  return ROLE_TAB_MAPPINGS[role].defaultTab
}

// Utility to handle browser back button with tab preservation
export function handleBrowserBack(role: UserRole, currentTab: string) {
  // Save current tab before navigating back
  saveCurrentTab(role, currentTab)
  
  // Use browser's back functionality
  if (typeof window !== 'undefined') {
    window.history.back()
  }
}

// Utility for handling close/exit actions with confirmation
export function handleCloseWithConfirmation(
  hasUnsavedChanges: boolean,
  onConfirm: () => void,
  onCancel: () => void
) {
  if (hasUnsavedChanges) {
    // Show confirmation dialog
    const confirmed = window.confirm(
      'You have unsaved changes. Are you sure you want to leave this page?'
    )
    if (confirmed) {
      onConfirm()
    } else {
      onCancel()
    }
  } else {
    onConfirm()
  }
}
