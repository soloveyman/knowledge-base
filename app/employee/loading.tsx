import { Skeleton, SkeletonCard, SkeletonList } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8 space-y-6">
        {/* Greeting Card Skeleton */}
        <SkeletonCard className="p-6" />
        
        {/* Tabs Skeleton */}
        <div className="space-y-6">
          <Skeleton className="h-9 w-full rounded-3xl" />
          
          {/* Content Skeleton - Assignment Cards */}
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} className="p-6" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

