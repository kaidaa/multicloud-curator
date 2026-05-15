import { Outlet } from "react-router-dom"

import { Sidebar } from "@/layouts/Sidebar"
import { ToastContainer } from "@/shared/components/Toast"
import { AccountsProvider } from "@/shared/contexts/AccountsContext"
import { ToastProvider } from "@/shared/hooks/useToast"

export function AppLayout() {
  return (
    <ToastProvider>
      <AccountsProvider>
        <div className="flex h-screen overflow-hidden bg-bg">
          <Sidebar />
          <main className="flex-1 overflow-y-auto px-8 py-9">
            <Outlet />
          </main>
          <ToastContainer />
        </div>
      </AccountsProvider>
    </ToastProvider>
  )
}
