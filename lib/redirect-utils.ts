import { AppRouterInstance } from "next/navigation"

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
    tabs: ['overview', 'users', 'reports', 'settings']
  }
} as const

type UserRole = keyof typeof ROLE_TAB_MAPPINGS

// Get the previous tab from localStorage or default to the role's default tab
export function getPreviousTab(role: UserRole): string {
  if (typeof window === 'undefined') {
    return ROLE_TAB_MAPPINGS[role].defaultTab
  }
  
  const storedTab = localStorage.getItem(`previousTab_${role}`)
  const validTabs = ROLE_TAB_MAPPINGS[role].tabs
  
  if (storedTab && validTabs.includes(storedTab as any)) {
    return storedTab
  }
  
  return ROLE_TAB_MAPPINGS[role].defaultTab
}

// Save the current tab to localStorage
export function saveCurrentTab(role: UserRole, tab: string) {
  if (typeof window === 'undefined') return
  
  const validTabs = ROLE_TAB_MAPPINGS[role].tabs
  if (validTabs.includes(tab as any)) {
    localStorage.setItem(`previousTab_${role}`, tab)
  }
}

// Get the appropriate redirect URL based on role and previous tab
export function getRedirectUrl(role: UserRole, fallbackTab?: string): string {
  const tab = fallbackTab || getPreviousTab(role)
  return `/${role}?tab=${tab}`
}

// Navigate back to the previous tab with proper URL construction
export function navigateBack(router: AppRouterInstance, role: UserRole, fallbackTab?: string) {
  const redirectUrl = getRedirectUrl(role, fallbackTab)
  router.push(redirectUrl)
}

// Extract tab from URL search params
export function getTabFromUrl(searchParams: URLSearchParams): string | null {
  return searchParams.get('tab')
}

// Check if a tab is valid for a given role
export function isValidTab(role: UserRole, tab: string): boolean {
  const validTabs = ROLE_TAB_MAPPINGS[role].tabs
  return validTabs.includes(tab as any)
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
