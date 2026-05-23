import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"

import { Skeleton } from "@/shared/components/LoadingState"
import { useAccountsContext } from "@/shared/contexts/AccountsContext"

interface AnalyticsRouteGuardProps {
  children: ReactNode
}

export function AnalyticsRouteGuard({ children }: AnalyticsRouteGuardProps) {
  const { accounts, isLoading } = useAccountsContext()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    )
  }

  if (accounts.length === 0) {
    return <Navigate to="/pengaturan/akun" replace />
  }

  return <>{children}</>
}
