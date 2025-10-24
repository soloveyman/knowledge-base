import { redirect } from "next/navigation"

export default function Home() {
  // Always redirect to signin - let middleware handle authenticated routing
  redirect("/auth/signin")
}
