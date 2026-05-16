import { NavLink } from "react-router-dom"
import {
  ArrowsClockwise,
  Broom,
  CloudCheck,
  CopySimple,
  Gauge,
  Hash,
  PlugsConnected,
  ShieldCheck,
  type Icon,
} from "@phosphor-icons/react"

import { useAccountsContext } from "@/shared/contexts/AccountsContext"
import { formatDateID } from "@/shared/utils/formatDate"

interface NavItem {
  label: string
  to: string
  icon: Icon
  enabled: boolean
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
      { label: "Duplikasi", to: "/duplikasi", icon: CopySimple, enabled: true },
      { label: "File Besar dan Usang", to: "/file-besar-usang", icon: Broom, enabled: true },
      { label: "Keamanan File", to: "/keamanan", icon: ShieldCheck, enabled: true },
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

export function Sidebar() {
  const { snapshotAt } = useAccountsContext()

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
              {group.items.map((item) => (
                <li key={item.to}>
                  {item.enabled ? (
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
                      title={DISABLED_TOOLTIP}
                      className="flex w-full cursor-not-allowed items-center gap-3 rounded-[--radius-sm] px-3 py-2 text-sm text-muted-2 opacity-60"
                    >
                      <item.icon size={18} weight="regular" />
                      <span>{item.label}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-2">Snapshot</p>
        <p className="mt-1 text-xs text-muted">
          {snapshotAt ? formatDateID(snapshotAt) : "—"}
        </p>
        <button
          type="button"
          disabled
          title={DISABLED_TOOLTIP}
          className="mt-3 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-[--radius-sm] border border-line bg-panel px-3 py-2 text-xs text-muted-2 opacity-60"
        >
          <ArrowsClockwise size={14} weight="bold" />
          <span>Refresh semua akun</span>
        </button>
      </div>
    </aside>
  )
}
