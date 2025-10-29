import { useTranslation } from './translation-context'
import type { TranslationKey } from './translations'

// Badge translation mapping
const badgeTranslationMap: Record<string, string> = {
  // Status badges
  'active': 'active',
  'inactive': 'inactive',
  'failed': 'failed',
  'pending': 'pending',
  'completed': 'completed',
  'draft': 'draft',
  'published': 'published',
  'archived': 'archived',
  'in_progress': 'inProgress',
  'in progress': 'inProgress',
  'not_started': 'notStarted',
  'not started': 'notStarted',
  
  // Role badges
  'employee': 'employee',
  'manager': 'manager',
  'owner': 'owner',
  'admin': 'admin',
  
  // Document types
  'pdf': 'pdf',
  'docx': 'docx',
  'txt': 'txt',
  'html': 'html',
  'markdown': 'markdown',
  
  // Test types
  'multiple_choice': 'multipleChoice',
  'multiple choice': 'multipleChoice',
  'true_false': 'trueFalse',
  'true/false': 'trueFalse',
  'short_answer': 'shortAnswer',
  'short answer': 'shortAnswer',
  'text': 'textAnswer',
  'text answer': 'textAnswer',
  'essay': 'essay',
  
  // Difficulty levels
  'easy': 'easy',
  'medium': 'medium',
  'hard': 'hard',
  'mixed': 'mixed',
  
  // Locales
  'en': 'english',
  'english': 'english',
  'ru': 'russian',
  'russian': 'russian',
  'es': 'spanish',
  'spanish': 'spanish',
  'fr': 'french',
  'french': 'french',
  'de': 'german',
  'german': 'german',
  
  // Plans
  'basic': 'basic',
  'pro': 'pro',
  'enterprise': 'enterprise',
  
  // Invoice status
  'paid': 'paid',
  'refunded': 'refunded',
  
  // Special badges
  'new': 'new',
  'popular': 'mostPopular',
  'most popular': 'mostPopular',
  'updated': 'updated',
}

export function translateBadgeLabel(label: string): string {
  if (!label || typeof label !== 'string') {
    return label || ''
  }
  
  const normalizedLabel = label.toLowerCase().trim()
  const translationKey = badgeTranslationMap[normalizedLabel]
  
  if (translationKey) {
    // This will be used with the useTranslation hook
    return translationKey
  }
  
  // Return original label if no translation found
  return label
}

export function useBadgeTranslation() {
  const { t } = useTranslation()
  
  return (label: string): string => {
    if (!label || typeof label !== 'string') {
      return label || ''
    }
    
    const translationKey = translateBadgeLabel(label)
    return t(translationKey as TranslationKey) || label
  }
}
