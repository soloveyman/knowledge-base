import { NextResponse } from "next/server"
import { db, users } from "@/lib/db"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

export async function GET() {
  try {
    const results = {
      database: "unknown" as "ok" | "error" | "unknown",
      dbError: null as string | null,
      testQuery: "unknown" as "ok" | "error" | "unknown",
      queryError: null as string | null,
      env: {
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || "NOT SET",
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "SET" : "NOT SET",
        DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
      }
    }

    // Test database connection
    try {
      await db.select().from(users).limit(1)
      results.database = "ok"
      results.testQuery = "ok"
    } catch (error) {
      results.database = "error"
      results.testQuery = "error"
      results.dbError = error instanceof Error ? error.message : String(error)
    }

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json({
      error: "Failed to run diagnostics",
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

