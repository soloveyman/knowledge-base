import { UserRole } from "@/lib/auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string
      image?: string
      role: UserRole
      businessId: string
      businessName: string
    }
  }

  interface User {
    id: string
    email: string
    name?: string
    image?: string
    role: UserRole
    businessId: string
    businessName: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole
    businessId: string
    businessName: string
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role?: UserRole
    businessId?: string
    businessName?: string
  }
}
