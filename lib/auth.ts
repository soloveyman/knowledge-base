import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { z } from "zod"
import { db, users } from "./db"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          const { email, password } = loginSchema.parse(credentials)
          
          // Find user in database
          const dbUsers = await db.select().from(users).where(eq(users.email, email)).limit(1)
          
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
          return {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name || undefined,
            role: dbUser.role as UserRole,
            businessId: 'business-1', // You can add this to your schema later
            businessName: 'Knowledge Base', // You can add this to your schema later
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Ensure token.sub is always the DB user id (important for OAuth providers)
        // so session.user.id matches our users.id UUID everywhere
        token.sub = user.id
        token.role = user.role as UserRole
        token.businessId = user.businessId
        token.businessName = user.businessName
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
