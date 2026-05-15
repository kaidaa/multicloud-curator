import { MagnifyingGlass } from "@phosphor-icons/react"

import { useToast } from "@/shared/hooks/useToast"

// Placeholder untuk halaman Eksplorasi sebelum fitur Federated Search
// (fitur 3) selesai. Visual menyerupai mockup search-trigger; klik
// menghasilkan toast info supaya jelas behavior penuh menyusul.
export function SearchTriggerButton() {
  const { pushToast } = useToast()

  function handleClick() {
    pushToast(
      "Pencarian lintas akun akan aktif di milestone fitur Federated Search berikutnya.",
      "info",
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center justify-between gap-3 rounded-[--radius] border border-line bg-panel px-4 py-3 text-left text-sm text-muted transition hover:border-line-strong hover:bg-panel-soft"
    >
      <span className="flex items-center gap-3">
        <MagnifyingGlass size={18} weight="bold" className="text-muted" />
        <span>Cari metadata file lintas Google Drive dan Dropbox</span>
      </span>
      <span className="hidden text-[11px] uppercase tracking-[0.16em] text-muted-2 sm:inline">
        Segera hadir
      </span>
    </button>
  )
}
