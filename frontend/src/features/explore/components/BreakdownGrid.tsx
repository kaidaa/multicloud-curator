import type { Account } from "@/features/accounts/api"
import type { QuotaSummary } from "@/features/explore/api"
import { BreakdownCard } from "@/features/explore/components/BreakdownCard"

interface BreakdownGridProps {
  accounts: Account[]
  quotaSummary?: QuotaSummary | null
}

// Jumlah kolom adaptif berdasarkan jumlah akun supaya komposisi tetap
// seimbang: 1-3 akun stack vertikal rapi, 4-6 dua kolom di lebar sm+,
// 7+ tiga kolom di lg+. Class string literal supaya Tailwind JIT scan
// mendapat semua varian.
const GRID_CLASS_BY_COLUMNS: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
}

function computeBreakdownColumns(count: number): 1 | 2 | 3 {
  if (count <= 3) return 1
  if (count <= 6) return 2
  return 3
}

export function BreakdownGrid({ accounts, quotaSummary }: BreakdownGridProps) {
  const columns = computeBreakdownColumns(accounts.length)
  const quotaByAccount = new Map(
    quotaSummary?.perAccount.map((account) => [account.accountId, account]) ?? [],
  )
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[--radius] border border-line bg-panel shadow-soft">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-2">
          Breakdown per akun
        </h2>
      </header>
      <div className={`grid flex-1 gap-2 p-5 ${GRID_CLASS_BY_COLUMNS[columns]}`}>
        {accounts.map((account) => (
          <BreakdownCard
            key={account.id}
            account={account}
            quotaAccount={quotaByAccount.get(account.id)}
          />
        ))}
      </div>
    </section>
  )
}
