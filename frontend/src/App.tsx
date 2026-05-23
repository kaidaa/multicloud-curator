import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { AccountsPage } from "@/features/accounts/pages/AccountsPage"
import { DuplicatesPage } from "@/features/duplicates/pages/DuplicatesPage"
import { ExplorePage } from "@/features/explore/pages/ExplorePage"
import { KeywordsPage } from "@/features/keywords/pages/KeywordsPage"
import { LargeStalePage } from "@/features/large_stale/pages/LargeStalePage"
import { SearchFullView } from "@/features/search/pages/SearchFullView"
import { SecurityPage } from "@/features/security/pages/SecurityPage"
import { AppLayout } from "@/layouts/AppLayout"
import { AnalyticsRouteGuard } from "@/shared/components/AnalyticsRouteGuard"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/eksplorasi" replace />} />
          <Route path="eksplorasi" element={<ExplorePage />} />
          <Route path="cari" element={<SearchFullView />} />
          <Route
            path="duplikasi"
            element={
              <AnalyticsRouteGuard>
                <DuplicatesPage />
              </AnalyticsRouteGuard>
            }
          />
          <Route
            path="file-besar-usang"
            element={
              <AnalyticsRouteGuard>
                <LargeStalePage />
              </AnalyticsRouteGuard>
            }
          />
          <Route
            path="keamanan"
            element={
              <AnalyticsRouteGuard>
                <SecurityPage />
              </AnalyticsRouteGuard>
            }
          />
          <Route path="pengaturan/akun" element={<AccountsPage />} />
          <Route path="pengaturan/keyword" element={<KeywordsPage />} />
          <Route path="*" element={<Navigate to="/eksplorasi" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
