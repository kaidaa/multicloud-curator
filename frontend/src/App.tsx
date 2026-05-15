import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { AccountsPage } from "@/features/accounts/pages/AccountsPage"
import { ExplorePage } from "@/features/explore/pages/ExplorePage"
import { AppLayout } from "@/layouts/AppLayout"
import { ComingSoonPage } from "@/layouts/ComingSoonPage"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/eksplorasi" replace />} />
          <Route path="eksplorasi" element={<ExplorePage />} />
          <Route path="duplikasi" element={<ComingSoonPage label="Duplikasi" />} />
          <Route path="file-besar-usang" element={<ComingSoonPage label="File Besar dan Usang" />} />
          <Route path="keamanan" element={<ComingSoonPage label="Keamanan File" />} />
          <Route path="pengaturan/akun" element={<AccountsPage />} />
          <Route path="pengaturan/keyword" element={<ComingSoonPage label="Keyword Sensitif" />} />
          <Route path="*" element={<Navigate to="/eksplorasi" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
