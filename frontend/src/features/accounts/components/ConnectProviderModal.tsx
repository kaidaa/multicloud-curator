import { useState } from "react"
import { CaretRight, CircleNotch } from "@phosphor-icons/react"

import type { Provider } from "@/features/accounts/api"
import {
  getProviderLabel,
  ProviderLogo,
} from "@/features/accounts/components/ProviderLogo"
import { Modal } from "@/shared/components/Modal"

interface ConnectProviderModalProps {
  open: boolean
  onClose: () => void
  onConnect: (provider: Provider) => Promise<void>
}

const PROVIDERS: Provider[] = ["google", "dropbox"]

const PROVIDER_DESCRIPTION: Record<Provider, string> = {
  google: "Baca metadata file dan kuota akun Google Drive.",
  dropbox: "Baca metadata file dan kuota akun Dropbox.",
}

export function ConnectProviderModal({
  open,
  onClose,
  onConnect,
}: ConnectProviderModalProps) {
  const [pending, setPending] = useState<Provider | null>(null)

  async function handlePick(provider: Provider) {
    if (pending) return
    setPending(provider)
    try {
      await onConnect(provider)
    } finally {
      setPending(null)
    }
  }

  function handleClose() {
    if (pending) return
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Tambah akun"
      description="Pilih penyedia penyimpanan untuk melanjutkan alur otorisasi."
      busy={pending !== null}
    >
      {pending ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <CircleNotch size={32} className="animate-spin text-primary" weight="bold" />
          <div className="text-center">
            <p className="text-sm font-semibold text-ink">
              Menghubungkan {getProviderLabel(pending)}
            </p>
            <p className="mt-1 text-xs text-muted">
              Simulasi alur OAuth dan callback berhasil.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {PROVIDERS.map((provider) => (
            <li key={provider}>
              <button
                type="button"
                onClick={() => handlePick(provider)}
                className="flex w-full items-center gap-4 rounded-[--radius] border border-line bg-bg px-4 py-3 text-left transition hover:border-line-strong hover:bg-panel-soft"
              >
                <ProviderLogo provider={provider} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {getProviderLabel(provider)}
                  </p>
                  <p className="text-xs text-muted">{PROVIDER_DESCRIPTION[provider]}</p>
                </div>
                <CaretRight size={18} className="text-muted-2" weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
