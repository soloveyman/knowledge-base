import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { ZodSchema } from 'zod'

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

  // Log full error details server-side
  console.error(`API Error [${statusCode}]:`, {
    message: errorMessage,
    stack: errorStack,
    name: error instanceof Error ? error.name : typeof error,
  })

  return NextResponse.json(
    {
      success: false,
      message: defaultMessage,
      error: errorMessage,
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

