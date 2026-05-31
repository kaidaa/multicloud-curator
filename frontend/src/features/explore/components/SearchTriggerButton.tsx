import { useState } from "react"
import { MagnifyingGlass } from "@phosphor-icons/react"

import { SearchDrawer } from "@/features/search/components/SearchDrawer"

// Keep drawer state here so ExplorePage stays unaware of search internals.
export function SearchTriggerButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-[--radius] border border-line bg-bg px-4 py-3 text-left text-sm text-muted transition hover:border-line-strong hover:bg-primary-soft/40"
      >
        <span className="flex items-center gap-3">
          <MagnifyingGlass size={18} weight="bold" className="text-muted" />
          <span>Cari file lintas Google Drive dan Dropbox</span>
        </span>
        <span className="hidden text-[11px] text-muted-2 sm:inline">
          Tekan untuk mencari
        </span>
      </button>
      <SearchDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}
