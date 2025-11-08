/**
 * List of known disposable/temporary email domains
 * This is a basic list - in production, consider using a service like:
 * - https://www.disposable-email-detector.com/
 * - https://www.validator.pizza/
 * - Or maintain your own updated list
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  // Common disposable email services
  '10minutemail.com',
  'tempmail.com',
  'guerrillamail.com',
  'mailinator.com',
  'throwaway.email',
  'temp-mail.org',
  'getnada.com',
  'mohmal.com',
  'yopmail.com',
  'sharklasers.com',
  'grr.la',
  'guerrillamailblock.com',
  'pokemail.net',
  'spam4.me',
  'bccto.me',
  'chacuo.net',
  'dispostable.com',
  'meltmail.com',
  'emailondeck.com',
  'fakeinbox.com',
  'maildrop.cc',
  'mintemail.com',
  'mytrashmail.com',
  'sharklasers.com',
  'spamgourmet.com',
  'tempail.com',
  'trashmail.com',
  'trashmailer.com',
  'trbvm.com',
  'tyldd.com',
  '33mail.com',
  'mailcatch.com',
  'inboxkitten.com',
  'getairmail.com',
  'mailnesia.com',
  'melt.li',
  'mox.do',
  'tmpmail.org',
  'tmpmail.net',
  'tmpmail.com',
  'tempr.email',
  'throwaway.email',
  'anonmails.de',
  'jetable.org',
  'mail-temp.com',
  'mytemp.email',
  'temp-mail.io',
  'temp-mail.ru',
  'tempail.com',
  'tempmailo.com',
  'throwawaymail.com',
  'tmail.ws',
  'trash-mail.com',
  'trashmail.at',
  'trashmail.com',
  'trashmail.de',
  'trashmail.me',
  'trashmail.net',
  'trashmail.org',
  'trashmailer.com',
  'trbvm.com',
  'tyldd.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'zippymail.info',
  'zoemail.org',
])

/**
 * Check if an email domain is disposable/temporary
 * @param email - Email address to check
 * @returns true if disposable, false otherwise
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  
  const normalizedEmail = email.toLowerCase().trim()
  const domain = normalizedEmail.split('@')[1]
  
  if (!domain) return false
  
  return DISPOSABLE_EMAIL_DOMAINS.has(domain)
}

/**
 * Validate email is not disposable
 * @param email - Email address to validate
 * @returns Error message if disposable, null if valid
 */
export function validateNotDisposableEmail(email: string): string | null {
  if (isDisposableEmail(email)) {
    return 'Disposable/temporary email addresses are not allowed. Please use a real email address.'
  }
  return null
}

