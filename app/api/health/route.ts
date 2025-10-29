import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: {
    connected: boolean;
    version?: string;
    latency?: number;
    error?: string;
  };
  environment: {
    nodeEnv: string;
    hasDatabaseUrl: boolean;
  };
}

export async function GET() {
  const startTime = Date.now();
  const status: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: {
      connected: false,
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    },
  };

  try {
    // Test database connection with query
    const dbStartTime = Date.now();
    const result = await db.execute(
      sql`SELECT version() as version`
    );
    const dbLatency = Date.now() - dbStartTime;

    // Extract version from result (drizzle returns rows array)
    const versionRow = result.rows?.[0] as { version?: string } | undefined;

    status.database = {
      connected: true,
      version: versionRow?.version || 'unknown',
      latency: dbLatency,
    };

    // Consider unhealthy if latency is too high (>5s)
    if (dbLatency > 5000) {
      status.status = 'unhealthy';
      return NextResponse.json(status, { status: 503 });
    }

    return NextResponse.json(status);
  } catch (error) {
    status.status = 'unhealthy';
    status.database = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    const totalLatency = Date.now() - startTime;
    return NextResponse.json(
      {
        ...status,
        latency: totalLatency,
      },
      { status: 503 }
    );
  }
}

