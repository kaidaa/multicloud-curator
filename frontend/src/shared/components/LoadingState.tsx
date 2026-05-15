interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse rounded-sm bg-panel-soft ${className}`} />
}

interface SkeletonRowsProps {
  count?: number
  rowClassName?: string
}

export function SkeletonRows({ count = 3, rowClassName = "h-20" }: SkeletonRowsProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className={rowClassName} />
      ))}
    </div>
  )
}
