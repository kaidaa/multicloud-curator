import type { Account } from "@/features/accounts/api"
import type { QuotaSummary } from "@/features/explore/api"
import { BreakdownCard } from "@/features/explore/components/BreakdownCard"
import { isAccountEffectivelyLoading } from "@/shared/utils/accountLifecycle"

interface BreakdownGridProps {
  accounts: Account[]
  quotaSummary?: QuotaSummary | null
  loadingAccountIds?: string[]
}

// Keep class variants literal so Tailwind can detect them.
const GRID_CLASS_BY_COLUMNS: Record<1 | 2, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
}

function computeBreakdownColumns(count: number): 1 | 2 {
  return count <= 2 ? 1 : 2
}

export function BreakdownGrid({
  accounts,
  quotaSummary,
  loadingAccountIds = [],
}: BreakdownGridProps) {
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
        {accounts.map((account, idx) => {
          const spansTwoColumns =
            columns === 2 && accounts.length % 2 === 1 && idx === accounts.length - 1

          return (
            <div key={account.id} className={spansTwoColumns ? "sm:col-span-2" : undefined}>
              <BreakdownCard
                account={account}
                quotaAccount={quotaByAccount.get(account.id)}
                isLoading={isAccountEffectivelyLoading(account, loadingAccountIds)}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
