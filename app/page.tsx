import { redirect } from "next/navigation"

// Static redirect page - can be statically generated
export const dynamic = 'force-static'

export default function Home() {
  // Server-side redirect for better FCP - no client-side JS needed
  redirect("/auth/signin")
}
