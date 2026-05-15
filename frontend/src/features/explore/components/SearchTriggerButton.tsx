import { useState } from "react"
import { MagnifyingGlass } from "@phosphor-icons/react"

import { SearchDrawer } from "@/features/search/components/SearchDrawer"

// Entry point pencarian dari halaman Eksplorasi. Drawer state dikelola
// self-contained di sini supaya ExplorePage tidak perlu tahu detail
// pencarian (kunci boundary file Feature 3 vs Feature 2).
export function SearchTriggerButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-[--radius] border border-line bg-panel px-4 py-3 text-left text-sm text-muted transition hover:border-line-strong hover:bg-panel-soft"
      >
        <span className="flex items-center gap-3">
          <MagnifyingGlass size={18} weight="bold" className="text-muted" />
          <span>Cari metadata file lintas Google Drive dan Dropbox</span>
        </span>
        <span className="hidden text-[11px] uppercase tracking-[0.16em] text-muted-2 sm:inline">
          Tekan untuk mencari
        </span>
      </button>
      <SearchDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}
