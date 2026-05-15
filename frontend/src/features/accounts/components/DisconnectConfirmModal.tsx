import { useState } from "react"
import { CircleNotch } from "@phosphor-icons/react"

import type { Account } from "@/features/accounts/api"
import {
  getProviderLabel,
  ProviderLogo,
} from "@/features/accounts/components/ProviderLogo"
import { Modal } from "@/shared/components/Modal"

interface DisconnectConfirmModalProps {
  account: Account | null
  onClose: () => void
  onConfirm: (accountId: string) => Promise<void>
}

export function DisconnectConfirmModal({
  account,
  onClose,
  onConfirm,
}: DisconnectConfirmModalProps) {
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    if (!account || busy) return
    setBusy(true)
    try {
      await onConfirm(account.id)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  function handleClose() {
    if (busy) return
    onClose()
  }

  return (
    <Modal
      open={account !== null}
      onClose={handleClose}
      title="Putus koneksi akun?"
      description="Metadata file dan hasil scan dari akun ini akan dihapus dari sistem lokal. File asli di penyedia penyimpanan tidak terpengaruh."
      size="sm"
      busy={busy}
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
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-[--radius-sm] bg-danger px-4 py-2 text-sm font-medium text-white transition hover:bg-danger-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <CircleNotch size={14} className="animate-spin" weight="bold" />}
            <span>Putus koneksi</span>
          </button>
        </>
      }
    >
      {account && (
        <div className="flex items-center gap-3 rounded-[--radius-sm] bg-panel-soft px-4 py-3">
          <ProviderLogo provider={account.provider} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{getProviderLabel(account.provider)}</p>
            <p className="truncate text-xs text-muted">{account.email}</p>
          </div>
        </div>
      )}
    </Modal>
  )
}
