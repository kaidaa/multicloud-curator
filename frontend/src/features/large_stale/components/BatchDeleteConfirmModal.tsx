import { useState } from "react"
import { CircleNotch } from "@phosphor-icons/react"

import type { LargeStaleFile } from "@/features/large_stale/api"
import { Modal } from "@/shared/components/Modal"
import { formatBytes } from "@/shared/utils/formatSize"

interface BatchDeleteConfirmModalProps {
  open: boolean
  files: LargeStaleFile[]
  onConfirm: () => Promise<void>
  onCancel: () => void
}

// Keep separate until a shared batch-action modal is justified.
export function BatchDeleteConfirmModal({
  open,
  files,
  onConfirm,
  onCancel,
}: BatchDeleteConfirmModalProps) {
  const [busy, setBusy] = useState(false)
  const count = files.length

  async function handleConfirm() {
    if (busy || count === 0) return
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  function handleClose() {
    if (busy) return
    onCancel()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Hapus ${count} file?`}
      description="File akan dihapus dari penyedia penyimpanan (Google Drive / Dropbox) secara permanen. Aksi ini tidak dapat dibatalkan dari aplikasi ini."
      busy={busy}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-[--radius-sm] border border-line bg-panel px-4 py-2 text-sm text-ink-soft transition hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || count === 0}
            className="inline-flex items-center gap-2 rounded-[--radius-sm] bg-danger px-4 py-2 text-sm font-medium text-white transition hover:bg-danger-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <CircleNotch size={14} className="animate-spin" weight="bold" />}
            <span>Hapus {count} file</span>
          </button>
        </>
      }
    >
      <ul className="max-h-[280px] divide-y divide-line overflow-y-auto rounded-[--radius-sm] border border-line bg-panel-soft/40">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{file.name}</p>
              <p className="truncate text-xs text-muted">{file.accountEmail}</p>
            </div>
            <span className="flex-shrink-0 text-xs text-muted">
              {formatBytes(file.sizeBytes)}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
