"use client"

import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function TestSessionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Current Session</CardTitle>
        </CardHeader>
        <CardContent>
          {status === "loading" ? (
            <div>Loading session...</div>
          ) : session ? (
            <div className="space-y-4">
              <div><strong>Authenticated:</strong> Yes</div>
              <div><strong>Email:</strong> {session.user.email}</div>
              <div><strong>Name:</strong> {session.user.name}</div>
              <div><strong>ID:</strong> {session.user.id}</div>
              <div><strong>Role:</strong> <span className="font-mono font-bold text-xl text-blue-600">{session.user.role}</span></div>
              <div><strong>Business ID:</strong> {session.user.businessId}</div>
              
              <div className="mt-4 space-x-2">
                <Button onClick={() => router.push("/owner")}>Go to Owner Page</Button>
                <Button onClick={() => router.push("/manager")}>Go to Manager Page</Button>
                <Button onClick={() => router.push("/employee")}>Go to Employee Page</Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4">Not authenticated</div>
              <Button onClick={() => router.push("/auth/signin")}>Sign In</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

