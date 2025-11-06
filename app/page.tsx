import { redirect } from "next/navigation"

export default function Home() {
  // Server-side redirect for better FCP - no client-side JS needed
  redirect("/auth/signin")
}
