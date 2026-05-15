import type { Account } from "@/features/accounts/api"
import { BreakdownCard } from "@/features/explore/components/BreakdownCard"

interface BreakdownGridProps {
  accounts: Account[]
}

export function BreakdownGrid({ accounts }: BreakdownGridProps) {
  return (
    <section className="rounded-[--radius] border border-line bg-panel p-5 shadow-soft">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-2">
        Breakdown per akun
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {accounts.map((account) => (
          <BreakdownCard key={account.id} account={account} />
        ))}
      </div>
    </section>
  )
}
