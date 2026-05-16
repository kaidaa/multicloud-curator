import { Outlet } from "react-router-dom"

import { DuplicatesUiStateProvider } from "@/features/duplicates/contexts/DuplicatesUiStateContext"
import { LargeStaleUiStateProvider } from "@/features/large_stale/contexts/LargeStaleUiStateContext"
import { SecurityUiStateProvider } from "@/features/security/contexts/SecurityUiStateContext"
import { Sidebar } from "@/layouts/Sidebar"
import { ToastContainer } from "@/shared/components/Toast"
import { AccountsProvider } from "@/shared/contexts/AccountsContext"
import { ToastProvider } from "@/shared/hooks/useToast"

export function AppLayout() {
  return (
    <ToastProvider>
      <AccountsProvider>
        <DuplicatesUiStateProvider>
          <LargeStaleUiStateProvider>
            <SecurityUiStateProvider>
              <div className="flex h-screen overflow-hidden bg-bg">
                <Sidebar />
                <main className="flex-1 overflow-y-auto px-8 py-9">
                  <Outlet />
                </main>
                <ToastContainer />
              </div>
            </SecurityUiStateProvider>
          </LargeStaleUiStateProvider>
        </DuplicatesUiStateProvider>
      </AccountsProvider>
    </ToastProvider>
  )
}
