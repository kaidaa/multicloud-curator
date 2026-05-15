import { Hourglass } from "@phosphor-icons/react"

import { EmptyState } from "@/shared/components/EmptyState"

interface ComingSoonPageProps {
  label: string
}

export function ComingSoonPage({ label }: ComingSoonPageProps) {
  return (
    <>
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-2">Halaman</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">{label}</h1>
      </header>
      <EmptyState
        icon={<Hourglass size={28} weight="duotone" />}
        title="Belum tersedia di milestone ini"
        description="Halaman ini akan diaktifkan saat fitur terkait selesai dibangun. Untuk sekarang, lanjutkan dari menu Akun Terhubung."
      />
    </>
  )
}
