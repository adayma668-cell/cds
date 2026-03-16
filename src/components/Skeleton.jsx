"use client";

export default function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-muted/30 ${className}`}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl border border-card-border p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-[75%]" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="bg-card rounded-2xl border border-card-border p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-14 h-14 rounded-full shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TasksSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-card rounded-xl border border-card-border p-4 flex items-center gap-4">
            <Skeleton className="w-5 h-5 shrink-0 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamUpdatesSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-xl border border-card-border p-5">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-9 h-9 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-[80%]" />
          </div>
        ))}
      </div>
    </div>
  );
}
