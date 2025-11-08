import NextAuth from "next-auth"
import type { Session } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { z } from "zod"
import { NextResponse } from "next/server"
import { db, users } from "./db"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
// Rate limiting is handled in the NextAuth route handler (app/api/auth/[...nextauth]/route.ts)

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const oauthProviders = (
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })
      ]
    : []
)

// Ensure NEXTAUTH_URL is set
// For localhost, trustHost should handle it, but having NEXTAUTH_URL set is safer
const nextAuthUrl = process.env.NEXTAUTH_URL || 
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined)

// Log warning if NEXTAUTH_URL is not set
if (typeof process !== 'undefined' && !process.env.NEXTAUTH_URL) {
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  NEXTAUTH_URL is not set in production. This may cause authentication errors.')
    console.warn('⚠️  Set NEXTAUTH_URL in Vercel environment variables (e.g., https://uppstaff.vercel.app)')
  } else {
    console.warn('⚠️  NEXTAUTH_URL is not set. For localhost, trustHost: true should work, but consider setting NEXTAUTH_URL=http://localhost:3000 in .env.local')
  }
  console.warn('⚠️  Using trustHost: true as fallback')
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
  trustHost: true, // Allow NextAuth to trust the host from request headers (important for Vercel)
  debug: process.env.NODE_ENV === 'development', // Enable debug logging in development
  providers: [
    ...oauthProviders,
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          console.log("[Auth] Authorize called with credentials:", { email: credentials?.email ? "provided" : "missing" })
          
          const { email, password } = loginSchema.parse(credentials)
          const normalizedEmail = email.toLowerCase().trim()
          
          console.log("[Auth] Looking up user:", normalizedEmail)
          
          // Find user in database
          const dbUsers = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)
          
          if (dbUsers.length === 0) {
            console.log("[Auth] User not found:", normalizedEmail)
            return null
          }

          const dbUser = dbUsers[0] as { id: string; email: string; name: string | null; role: UserRole | null; password: string | null; businessId?: string | null; emailVerified: Date | null }
          
          // Check if user has a password (some users might not have one if created via OAuth)
          if (!dbUser.password) {
            console.log("[Auth] User has no password set:", normalizedEmail)
            return null
          }

          // Verify password
          console.log("[Auth] Verifying password for user:", normalizedEmail)
          const isValidPassword = await bcrypt.compare(password, dbUser.password)
          
          if (!isValidPassword) {
            console.log("[Auth] Invalid password for user:", normalizedEmail)
            return null
          }

          console.log("[Auth] Authentication successful for user:", normalizedEmail)
          
          // Check if email is verified (allow sign-in but mark as unverified)
          const isEmailVerified = dbUser.emailVerified !== null
          
          // Return user object for NextAuth
          const resolvedRole = ((dbUser.role ?? 'owner') as string).toLowerCase() as UserRole
          const resolvedBusinessId: string = dbUser.businessId ?? dbUser.id
          return {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name || undefined,
            role: resolvedRole,
            businessId: resolvedBusinessId,
            businessName: 'Knowledge Base',
            emailVerified: isEmailVerified,
          }
        } catch (error) {
          console.error("[Auth] Authorize error:", error)
          console.error("[Auth] Error details:", {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          })
          return null
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      try {
        if (account?.provider === 'google' && user?.email) {
          const existing = await db.select().from(users).where(eq(users.email, user.email)).limit(1)
          if (existing.length === 0) {
            const [created] = await db.insert(users).values({
              email: user.email,
              name: user.name ?? null,
              role: 'owner',
              country: 'US',
            }).returning()
            await db.update(users).set({ businessId: created.id }).where(eq(users.id, created.id))
            
            // Assign free trial to new owner (non-blocking)
            const { assignFreeTrialToOwner } = await import('@/lib/subscription/trial')
            try {
              await assignFreeTrialToOwner(created.id)
            } catch (error) {
              console.error('[Auth] Failed to assign free trial:', error)
            }
            
            const u = user as { id?: string; role?: UserRole; businessId?: string }
            u.id = created.id
            u.role = 'owner'
            u.businessId = created.id
          } else {
            const dbUser = existing[0] as unknown as { id: string; role: string; businessId?: string | null }
            const u = user as { id?: string; role?: UserRole; businessId?: string }
            u.id = dbUser.id
            u.role = (dbUser.role as string).toLowerCase() as UserRole
            u.businessId = (dbUser.businessId ?? dbUser.id)
          }
        }
        return true
      } catch (error) {
        console.error("[Auth] signIn callback error:", error)
        return false
      }
    },
    async jwt({ token, user }) {
      try {
        if (user) {
          // Ensure token.sub is always the DB user id (important for OAuth providers)
          // so session.user.id matches our users.id UUID everywhere
          const u = user as { id?: string; role?: UserRole; businessId?: string; businessName?: string; emailVerified?: boolean }
          token.sub = u.id ?? token.sub
          token.role = ((u.role as string | undefined)?.toLowerCase() as UserRole) ?? (token.role as UserRole)
          token.businessId = u.businessId ?? token.businessId
          token.businessName = u.businessName ?? token.businessName
          token.emailVerified = u.emailVerified ?? false
        } else {
          // Fallback: if role/businessId/businessName missing, hydrate from DB
          if ((!token.role || !token.businessId || !token.businessName) && token.sub) {
            try {
              const dbUsers = await db.select().from(users).where(eq(users.id, token.sub as string)).limit(1)
              if (dbUsers.length > 0) {
                const dbUser = dbUsers[0] as { role: string | null; businessId?: string | null }
                if (!token.role) token.role = ((dbUser.role ?? 'employee') as string).toLowerCase() as UserRole
                if (!token.businessId) token.businessId = dbUser.businessId ?? (token.sub as string)
                if (!token.businessName) token.businessName = 'Knowledge Base'
              }
            } catch (error) {
              console.error("[Auth] jwt callback DB fallback error:", error)
              // non-fatal; leave token as-is
            }
          }
        }
        return token
      } catch (error) {
        console.error("[Auth] jwt callback error:", error)
        return token // Return token even on error to avoid breaking auth
      }
    },
    async session({ session, token }) {
      try {
        if (token && token.sub) {
          session.user.id = token.sub
          session.user.role = (token.role as UserRole) ?? 'employee'
          session.user.businessId = token.businessId ?? token.sub
          session.user.businessName = token.businessName ?? 'Knowledge Base'
          ;(session.user as { emailVerified: boolean }).emailVerified = Boolean(token.emailVerified ?? false)
        }
        return session
      } catch (error) {
        console.error("[Auth] session callback error:", error)
        return session // Return session even on error
      }
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
})

export type UserRole = 'super-admin' | 'owner' | 'manager' | 'employee'

export interface User {
  id: string
  email: string
  name?: string
  image?: string
  role: UserRole
}


// Permission matrix based on your requirements
export const PERMISSIONS = {
  // Materials (Documents)
  MATERIALS: {
    owner: ['read'] as const,
    manager: ['create', 'read', 'update', 'delete'] as const,
    employee: [] as const
  },
  
  // Tests/Modules
  TESTS: {
    owner: ['read'] as const,
    manager: ['create', 'read', 'update', 'delete'] as const,
    employee: ['pass', 'read_own'] as const
  },
  
  // Assignments
  ASSIGNMENTS: {
    owner: ['read'] as const,
    manager: ['create', 'read', 'update', 'delete'] as const,
    employee: ['read_own'] as const
  },
  
  // Reports
  REPORTS: {
    owner: ['read'] as const,
    manager: ['read'] as const,
    employee: ['read_own'] as const
  },
  
  // Subscription
  SUBSCRIPTION: {
    'super-admin': ['manage_all', 'view_all', 'create', 'update', 'cancel'] as const,
    owner: ['view_own', 'update_own'] as const,
    manager: [] as const,
    employee: [] as const
  }
} as const

type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'pass' | 'read_own' | 'manage' | 'manage_all' | 'view_all' | 'view_own' | 'update_own' | 'cancel'

export function hasPermission(role: UserRole, resource: keyof typeof PERMISSIONS, action: PermissionAction): boolean {
  const rolePermissions = PERMISSIONS[resource][role as keyof typeof PERMISSIONS[typeof resource]]
  if (!rolePermissions) return false
  return (rolePermissions as readonly string[]).includes(action)
}

/**
 * Require authenticated user in API routes
 * Returns session with guaranteed user or NextResponse error
 * Provides type narrowing so TypeScript knows user exists
 * 
 * Usage:
 *   const authResult = await requireUser()
 *   if (authResult instanceof NextResponse) return authResult
 *   const { session } = authResult
 *   // Now TypeScript knows session.user exists
 */
export async function requireUser(): Promise<
  | { session: Session & { user: NonNullable<Session['user']> } }
  | NextResponse<{ success: false; message: string }>
> {
  const session = await auth()
  
  if (!session || !('user' in session) || !session.user) {
    return NextResponse.json(
      {
        success: false,
        message: 'Unauthorized. Please sign in.',
      },
      { status: 401 }
    )
  }

  return { session: session as Session & { user: NonNullable<Session['user']> } }
}

/**
 * Require authenticated user with specific role
 * Returns session with guaranteed user and role or NextResponse error
 * 
 * Usage:
 *   const authResult = await requireRole('owner')
 *   if (authResult instanceof NextResponse) return authResult
 *   const { session } = authResult
 *   // Now TypeScript knows session.user exists and has correct role
 */
export async function requireRole(
  role: UserRole | UserRole[]
): Promise<
  | { session: Session & { user: NonNullable<Session['user']> } }
  | NextResponse<{ success: false; message: string }>
> {
  const result = await requireUser()
  
  if (result instanceof NextResponse) {
    return result
  }

  const roles = Array.isArray(role) ? role : [role]
  const userRole = result.session.user.role

  if (!roles.includes(userRole)) {
    return NextResponse.json(
      {
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
      },
      { status: 403 }
    )
  }

  return result
}
