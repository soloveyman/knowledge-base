export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1D29]">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

