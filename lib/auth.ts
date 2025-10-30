import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { z } from "zod"
import { db, users } from "./db"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
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
          const { email, password } = loginSchema.parse(credentials)
          const normalizedEmail = email.toLowerCase().trim()
          
          // Find user in database
          const dbUsers = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)
          
          if (dbUsers.length === 0) {
            console.log("User not found:", email)
            return null
          }

          const dbUser = dbUsers[0]
          
          // Check if user has a password (some users might not have one if created via OAuth)
          if (!dbUser.password) {
            console.log("User has no password set:", email)
            return null
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(password, dbUser.password)
          
          if (!isValidPassword) {
            console.log("Invalid password for user:", email)
            return null
          }

          // Return user object for NextAuth
          const resolvedRole: UserRole = (dbUser.role as UserRole) ?? 'owner'
          const resolvedBusinessId: string = dbUser.id
          return {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name || undefined,
            role: resolvedRole,
            businessId: resolvedBusinessId,
            businessName: 'Knowledge Base',
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
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
          const u = user as { id?: string; role?: UserRole; businessId?: string }
          u.id = created.id
          u.role = 'owner'
          u.businessId = created.id
        } else {
          const dbUser = existing[0] as unknown as { id: string; role: UserRole; businessId?: string | null }
          const u = user as { id?: string; role?: UserRole; businessId?: string }
          u.id = dbUser.id
          u.role = dbUser.role
          u.businessId = (dbUser.businessId ?? dbUser.id)
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        // Ensure token.sub is always the DB user id (important for OAuth providers)
        // so session.user.id matches our users.id UUID everywhere
        const u = user as { id?: string; role?: UserRole; businessId?: string; businessName?: string }
        token.sub = u.id ?? token.sub
        token.role = (u.role as UserRole) ?? (token.role as UserRole)
        token.businessId = u.businessId ?? token.businessId
        token.businessName = u.businessName ?? token.businessName
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as UserRole
        session.user.businessId = token.businessId
        session.user.businessName = token.businessName
      }
      return session
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
