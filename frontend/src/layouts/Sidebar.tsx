import { NavLink } from "react-router-dom"
import {
  ArrowsClockwise,
  Broom,
  CloudCheck,
  CopySimple,
  Gauge,
  Hash,
  LockKey,
  PlugsConnected,
  ShieldCheck,
  type Icon,
} from "@phosphor-icons/react"

import { useAccountsContext } from "@/shared/contexts/AccountsContext"
import { getErrorMessage } from "@/shared/api/errors"
import { useToast } from "@/shared/hooks/useToast"
import { getAccountLifecycleSummary } from "@/shared/utils/accountLifecycle"
import { formatDateID } from "@/shared/utils/formatDate"

interface NavItem {
  label: string
  to: string
  icon: Icon
  enabled: boolean
  requiresAccount?: boolean
}

interface NavGroup {
  heading: string
  items: NavItem[]
}

// Layout 3 grup mengikuti mockup mockup_ui.md / multicloud-curatorv2/app.js.
// Di M2 hanya "Akun Terhubung" yang aktif; sisanya akan di-enable per fitur
// saat halaman masing-masing siap.
const NAV_GROUPS: NavGroup[] = [
  {
    heading: "EKSPLORASI",
    items: [{ label: "Eksplorasi", to: "/eksplorasi", icon: Gauge, enabled: true }],
  },
  {
    heading: "KELOLA FILE",
    items: [
      { label: "Duplikasi", to: "/duplikasi", icon: CopySimple, enabled: true, requiresAccount: true },
      { label: "File Besar dan Usang", to: "/file-besar-usang", icon: Broom, enabled: true, requiresAccount: true },
      { label: "Keamanan File", to: "/keamanan", icon: ShieldCheck, enabled: true, requiresAccount: true },
    ],
  },
  {
    heading: "PENGATURAN",
    items: [
      { label: "Akun Terhubung", to: "/pengaturan/akun", icon: PlugsConnected, enabled: true },
      { label: "Keyword Sensitif", to: "/pengaturan/keyword", icon: Hash, enabled: true },
    ],
  },
]

const DISABLED_TOOLTIP = "Tersedia di milestone berikutnya"
const ACCOUNT_REQUIRED_TOOLTIP = "Hubungkan akun untuk membuka menu ini"

export function Sidebar() {
  const {
    accounts,
    isRefreshingAll,
    refreshAllAccounts,
    snapshotAt,
  } = useAccountsContext()
  const { pushToast } = useToast()
  const { hasAccounts } = getAccountLifecycleSummary(accounts)

  const canRefreshAll = accounts.length > 0 && !isRefreshingAll

  async function handleRefreshAll() {
    if (!canRefreshAll) return
    try {
      const summary = await refreshAllAccounts()
      if (summary.total === 0) {
        pushToast("Tidak ada akun yang perlu diperbarui.", "info")
        return
      }

      if (summary.failed.length > 0) {
        const firstMessages = summary.failed
          .map((failure) => failure.message)
          .filter(Boolean)
          .slice(0, 2)
          .join("; ")
        pushToast(
          `Pembaruan selesai: ${summary.completed} akun berhasil, ${summary.failed.length} gagal.${firstMessages ? ` ${firstMessages}` : ""}`,
          "error",
        )
        return
      }

      pushToast(`Pembaruan selesai: ${summary.completed} akun berhasil.`, "success")
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      pushToast(getErrorMessage(err), "error")
    }
  }

  return (
    <aside className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-line bg-sidebar">
      <div className="flex items-center gap-2 border-b border-line px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
          <CloudCheck size={20} weight="duotone" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink">Multicloud Curator</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Panel Kontrol</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.heading}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">
              {group.heading}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const itemEnabled =
                  item.enabled && (!item.requiresAccount || hasAccounts)
                const tooltip = item.requiresAccount && !hasAccounts
                  ? ACCOUNT_REQUIRED_TOOLTIP
                  : DISABLED_TOOLTIP

                return (
                <li key={item.to}>
                  {itemEnabled ? (
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-[--radius-sm] px-3 py-2 text-sm transition ${
                          isActive
                            ? "bg-primary-soft text-primary-strong"
                            : "text-ink-soft hover:bg-panel-soft"
                        }`
                      }
                    >
                      <item.icon size={18} weight="regular" />
                      <span>{item.label}</span>
                    </NavLink>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title={tooltip}
                      className="flex w-full cursor-not-allowed items-center gap-3 rounded-[--radius-sm] px-3 py-2 text-sm text-muted-2 opacity-60"
                    >
                      <item.icon size={18} weight="regular" />
                      <span>{item.label}</span>
                      {item.requiresAccount && !hasAccounts && (
                        <LockKey size={13} weight="bold" className="ml-auto" />
                      )}
                    </button>
                  )}
                </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-2">Terakhir Diperbarui</p>
        <p className="mt-1 text-xs text-muted">
          {snapshotAt ? formatDateID(snapshotAt) : "—"}
        </p>
        <button
          type="button"
          disabled={!canRefreshAll}
          title={
            accounts.length === 0
              ? "Hubungkan akun terlebih dahulu"
              : "Perbarui daftar file semua akun"
          }
          onClick={() => void handleRefreshAll()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[--radius-sm] bg-primary px-3.5 py-2 text-sm font-medium text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowsClockwise
            size={15}
            weight="bold"
            className={isRefreshingAll ? "animate-spin" : undefined}
          />
          <span>{isRefreshingAll ? "Memperbarui..." : "Perbarui semua akun"}</span>
        </button>
      </div>
    </aside>
  )
}
