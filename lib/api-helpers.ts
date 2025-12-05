import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { ZodSchema } from 'zod'
import { auth } from './auth'
import type { Session } from 'next-auth'

/**
 * Standardized API response helpers
 */

export interface ApiError {
  success: false
  message: string
  error?: string
  errors?: z.ZodIssue[]
  details?: unknown
}

export interface ApiSuccess<T = unknown> {
  success: true
  data?: T
  message?: string
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError

/**
 * Validate request body against a Zod schema
 * Returns parsed data or error response
 */
export async function validateRequest<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<
  | { success: true; data: T }
  | { success: false; response: NextResponse<ApiError> }
> {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      return {
        success: false,
        response: NextResponse.json(
          {
            success: false,
            message: 'Validation failed',
            errors: result.error.issues,
          },
          { status: 400 }
        ),
      }
    }

    return { success: true, data: result.data }
  } catch (error) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return {
        success: false,
        response: NextResponse.json(
          {
            success: false,
            message: 'Invalid JSON in request body',
            error: error.message,
          },
          { status: 400 }
        ),
      }
    }

    // Handle request body too large (Vercel limit: 4.5MB)
    if (error instanceof Error && error.message.includes('body')) {
      return {
        success: false,
        response: NextResponse.json(
          {
            success: false,
            message: 'Request body too large. Maximum payload size is 4.5MB.',
          },
          { status: 413 }
        ),
      }
    }

    // Re-throw unexpected errors
    throw error
  }
}

/**
 * Standardized error handler for API routes
 * Never exposes stack traces in production
 */
export function handleApiError(
  error: unknown,
  defaultMessage: string,
  statusCode = 500
): NextResponse<ApiError> {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined
  
  // Extract underlying database error if available (Drizzle wraps PostgreSQL errors)
  let dbError: string | undefined
  if (error instanceof Error) {
    const cause = (error as any).cause
    if (cause instanceof Error) {
      dbError = cause.message
    }
    // Check for common PostgreSQL error patterns
    if (errorMessage.includes('relation') || errorMessage.includes('column') || errorMessage.includes('does not exist')) {
      dbError = errorMessage
    }
  }

  // Check for "too many clients" error (database connection pool exhaustion)
  const isTooManyClients = errorMessage.includes('too many clients') || 
    (error instanceof Error && (error as any).cause?.message?.includes('too many clients')) ||
    dbError?.includes('too many clients')

  // Return specific error for connection pool exhaustion
  if (isTooManyClients) {
    console.error('API Error [503]: Database connection limit reached', {
      message: errorMessage,
      dbError,
      stack: errorStack,
    })

    return NextResponse.json(
      {
        success: false,
        message: 'Database connection limit reached. Please try again in a moment.',
        error: 'DATABASE_CONNECTION_LIMIT',
        retryAfter: 5,
      },
      { 
        status: 503,
        headers: {
          'Retry-After': '5',
        }
      }
    )
  }

  // Log full error details server-side
  console.error(`API Error [${statusCode}]:`, {
    message: errorMessage,
    dbError,
    stack: errorStack,
    name: error instanceof Error ? error.name : typeof error,
    cause: error instanceof Error ? (error as any).cause : undefined,
  })

  return NextResponse.json(
    {
      success: false,
      message: defaultMessage,
      error: dbError || errorMessage,
      // Only include stack trace in development
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
    },
    { status: statusCode }
  )
}

/**
 * Standardized success response
 */
export function successResponse<T>(
  data: T,
  message?: string,
  statusCode = 200
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status: statusCode }
  )
}

/**
 * Require authentication - returns session or error response
 */
export async function requireAuth(): Promise<
  | { success: true; session: Session }
  | { success: false; response: NextResponse<ApiError> }
> {
  const session = await auth()
  
  if (!session?.user) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: 'Unauthorized. Please sign in.',
        },
        { status: 401 }
      ),
    }
  }

  return { success: true, session }
}

/**
 * Require authentication with businessId (tenant) - returns session and businessId or error response
 */
export async function requireBusinessId(): Promise<
  | { success: true; session: Session; businessId: string }
  | { success: false; response: NextResponse<ApiError> }
> {
  const authResult = await requireAuth()
  
  if (!authResult.success) {
    return authResult
  }

  const { session } = authResult
  
  if (!session.user.businessId) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: 'Unauthorized: missing tenant',
        },
        { status: 401 }
      ),
    }
  }

  return {
    success: true,
    session,
    businessId: session.user.businessId,
  }
}

/**
 * Require specific role - returns session or error response
 */
export async function requireRole(
  allowedRoles: Array<'super-admin' | 'owner' | 'manager' | 'employee'>
): Promise<
  | { success: true; session: Session }
  | { success: false; response: NextResponse<ApiError> }
> {
  const authResult = await requireAuth()
  
  if (!authResult.success) {
    return authResult
  }

  const { session } = authResult
  const userRole = session.user.role

  if (!userRole || !allowedRoles.includes(userRole)) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: `Forbidden - this action requires one of the following roles: ${allowedRoles.join(', ')}`,
        },
        { status: 403 }
      ),
    }
  }

  return { success: true, session }
}

