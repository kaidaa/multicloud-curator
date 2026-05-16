import { useMemo, useState, type FormEvent } from "react"
import { Plus } from "@phosphor-icons/react"
import { Link } from "react-router-dom"

import { KeywordValidationError, type Keyword } from "@/features/keywords/api"
import { KeywordRow } from "@/features/keywords/components/KeywordRow"
import { Skeleton } from "@/shared/components/LoadingState"
import { useKeywords } from "@/features/keywords/hooks/useKeywords"
import { useToast } from "@/shared/hooks/useToast"

export function KeywordsPage() {
  const { keywords, isLoading, error, refetch, add, toggle, remove } = useKeywords()
  const { pushToast } = useToast()

  const [newKeywordInput, setNewKeywordInput] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const defaultKeywords = useMemo(
    () => keywords.filter((kw) => kw.category === "default"),
    [keywords],
  )
  const customKeywords = useMemo(
    () => keywords.filter((kw) => kw.category === "custom"),
    [keywords],
  )

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    const word = newKeywordInput.trim()
    if (word.length === 0) {
      setAddError("Keyword tidak boleh kosong")
      return
    }
    if (word.length < 2) {
      setAddError("Keyword minimum 2 karakter")
      return
    }
    setAddError(null)
    setIsAdding(true)
    try {
      const created = await add(word)
      setNewKeywordInput("")
      pushToast(`Keyword "${created.word}" ditambahkan.`, "success")
    } catch (err) {
      if (err instanceof KeywordValidationError) {
        setAddError(err.message)
      } else {
        pushToast(
          err instanceof Error ? err.message : "Gagal menambahkan keyword.",
          "error",
        )
      }
    } finally {
      setIsAdding(false)
    }
  }

  async function handleToggle(id: string) {
    try {
      await toggle(id)
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Gagal mengubah status keyword.",
        "error",
      )
    }
  }

  function handleAskDelete(id: string) {
    // Cuma 1 pending pada satu waktu — klik "Hapus" row lain reset pending.
    setPendingDeleteId(id)
  }

  function handleCancelDelete() {
    setPendingDeleteId(null)
  }

  async function handleConfirmDelete(id: string) {
    const target = keywords.find((kw) => kw.id === id)
    try {
      await remove(id)
      setPendingDeleteId(null)
      pushToast(
        target
          ? `Keyword "${target.word}" dihapus.`
          : "Keyword dihapus.",
        "success",
      )
    } catch (err) {
      setPendingDeleteId(null)
      pushToast(
        err instanceof Error ? err.message : "Gagal menghapus keyword.",
        "error",
      )
    }
  }

  function renderTable(keywordList: Keyword[]) {
    return (
      <div className="overflow-hidden rounded-[--radius] border border-line bg-panel">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Keyword
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Kategori
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {keywordList.map((kw) => (
                <KeywordRow
                  key={kw.id}
                  keyword={kw}
                  isPendingDelete={pendingDeleteId === kw.id}
                  onToggle={handleToggle}
                  onAskDelete={handleAskDelete}
                  onConfirmDelete={handleConfirmDelete}
                  onCancelDelete={handleCancelDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <>
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-2">Pengaturan</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Keyword Sensitif</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Keyword yang dipakai untuk mencocokkan nama file publik saat audit keamanan. Kelola daftar default dan tambahkan kustom sesuai konteks Anda.
        </p>
      </header>

      <section className="mt-6 rounded-[--radius] border border-line bg-panel p-4">
        <form className="flex flex-wrap items-start gap-3" onSubmit={handleAdd}>
          <div className="min-w-[240px] flex-1">
            <input
              type="text"
              value={newKeywordInput}
              onChange={(event) => {
                setNewKeywordInput(event.target.value)
                if (addError) setAddError(null)
              }}
              placeholder="Tambah keyword baru (min. 2 karakter)"
              className="w-full rounded-[--radius-sm] border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted-2 focus:border-line-strong focus:outline-none"
            />
            {addError && (
              <p className="mt-1.5 text-xs text-danger-strong">{addError}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isAdding || newKeywordInput.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-[--radius-sm] bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} weight="bold" />
            <span>Tambah</span>
          </button>
        </form>
      </section>

      <section className="mt-6">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[--radius] border border-danger-strong/30 bg-danger-soft px-5 py-4 text-sm text-danger-strong">
            <p className="font-medium">Gagal memuat daftar keyword.</p>
            <p className="mt-1 text-xs">{error}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 inline-flex items-center gap-2 rounded-[--radius-sm] bg-danger px-3 py-2 text-xs font-medium text-white transition hover:bg-danger-strong"
            >
              Coba lagi
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {defaultKeywords.length > 0 && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-2">
                  Keyword Default
                </h2>
                {renderTable(defaultKeywords)}
              </div>
            )}

            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-2">
                Keyword Kustom
              </h2>
              {customKeywords.length > 0 ? (
                renderTable(customKeywords)
              ) : (
                <div className="rounded-[--radius-sm] border border-dashed border-line bg-panel-soft/40 px-4 py-6 text-center text-sm text-muted">
                  Belum ada keyword kustom. Tambahkan di atas untuk memperluas deteksi.
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <p className="mt-6 text-xs text-muted-2">
        Perubahan keyword berlaku saat scan keamanan berikutnya.{" "}
        <Link to="/keamanan" className="text-primary-strong underline">
          Buka halaman Keamanan
        </Link>
      </p>
    </>
  )
}
