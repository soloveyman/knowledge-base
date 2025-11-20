import { NextRequest, NextResponse } from "next/server"

/**
 * Diagnostic endpoint to check OAuth configuration
 * Shows what redirect URI NextAuth will use
 * 
 * Access: GET /api/auth/debug
 */
export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "unknown"
  const protocol = req.headers.get("x-forwarded-proto") || 
                   (req.url.startsWith("https") ? "https" : "http")
  const baseUrl = `${protocol}://${host}`
  
  const nextAuthUrl = process.env.NEXTAUTH_URL
  const vercelUrl = process.env.VERCEL_URL
  const nodeEnv = process.env.NODE_ENV
  
  // Calculate what redirect URI NextAuth will use
  const calculatedRedirectUri = 
    nextAuthUrl 
      ? `${nextAuthUrl}/api/auth/callback/google`
      : vercelUrl
        ? `https://${vercelUrl}/api/auth/callback/google`
        : `${baseUrl}/api/auth/callback/google`
  
  return NextResponse.json({
    environment: {
      NODE_ENV: nodeEnv,
      host,
      protocol,
      baseUrl,
    },
    environmentVariables: {
      NEXTAUTH_URL: nextAuthUrl || "(not set)",
      VERCEL_URL: vercelUrl || "(not set)",
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID 
        ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` 
        : "(not set)",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET 
        ? "(set)" 
        : "(not set)",
    },
    calculatedRedirectUri,
    instructions: {
      step1: "Copy the 'calculatedRedirectUri' above",
      step2: "Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials",
      step3: "Find your OAuth 2.0 Client ID (Web application)",
      step4: "In 'Authorized redirect URIs', add the calculatedRedirectUri",
      step5: "Make sure NEXTAUTH_URL is set in Vercel for Production environment",
      step6: "Redeploy your application after changing environment variables",
    },
    commonIssues: {
      issue1: "If calculatedRedirectUri uses vercel.app domain, set NEXTAUTH_URL=https://uppstaff.net in Vercel",
      issue2: "Make sure redirect URI in Google Cloud Console matches EXACTLY (including https/http)",
      issue3: "Wait 2-5 minutes after adding redirect URI in Google Cloud Console",
      issue4: "Clear browser cache or use incognito mode",
    }
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    }
  })
}

