import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { z } from "zod"

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
          
          // Mock users for testing - no database required
          const mockUsers = {
            'owner@test.com': {
              id: 'owner-1',
              email: 'owner@test.com',
              name: 'John Owner',
              role: 'owner' as UserRole,
              businessId: 'business-1',
              businessName: 'Test Company',
            },
            'manager@test.com': {
              id: 'manager-1', 
              email: 'manager@test.com',
              name: 'Jane Manager',
              role: 'manager' as UserRole,
              businessId: 'business-1',
              businessName: 'Test Company',
            },
            'employee@test.com': {
              id: 'employee-1',
              email: 'employee@test.com', 
              name: 'Bob Employee',
              role: 'employee' as UserRole,
              businessId: 'business-1',
              businessName: 'Test Company',
            }
          }

          const user = mockUsers[email as keyof typeof mockUsers]
          
          if (!user) {
            return null
          }

          // Accept any password for test users
          return user
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

export type UserRole = 'owner' | 'manager' | 'employee'

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
    owner: ['manage'] as const,
    manager: [] as const,
    employee: [] as const
  }
} as const

type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'pass' | 'read_own' | 'manage'

export function hasPermission(role: UserRole, resource: keyof typeof PERMISSIONS, action: PermissionAction): boolean {
  const rolePermissions = PERMISSIONS[resource][role]
  return (rolePermissions as readonly string[]).includes(action)
}
