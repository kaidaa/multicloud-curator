// Shape snake_case mirror Interface Contract §7.
export interface KeywordResponse {
  id: string
  word: string
  category: "default" | "custom"
  active: boolean
  created_at: string
}

const SEED_CREATED_AT = "2026-01-01T00:00:00Z"

const initialKeywords: KeywordResponse[] = [
  {
    id: "kw-default-001",
    word: "KTP",
    category: "default",
    active: true,
    created_at: SEED_CREATED_AT,
  },
  {
    id: "kw-default-002",
    word: "NPWP",
    category: "default",
    active: true,
    created_at: SEED_CREATED_AT,
  },
  {
    id: "kw-default-003",
    word: "BPJS",
    category: "default",
    active: true,
    created_at: SEED_CREATED_AT,
  },
]

// Mutable in-memory state — pattern sama dengan mockAccountsState dst.
let mockKeywordsState: KeywordResponse[] = initialKeywords.map((kw) => ({ ...kw }))

export function getMockKeywords(): KeywordResponse[] {
  // Sort: default first (alphabetical), lalu custom (alphabetical).
  // Spec §3.1: sort by category asc lalu word asc.
  return [...mockKeywordsState].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category === "default" ? -1 : 1
    }
    return a.word.localeCompare(b.word, "id-ID", { sensitivity: "base" })
  })
}

// Validation mirror service layer specs/06 §5.1.
export class KeywordValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "KeywordValidationError"
  }
}

function validateKeyword(rawWord: string): string {
  const word = rawWord.trim()
  if (word.length === 0) {
    throw new KeywordValidationError("Keyword tidak boleh kosong")
  }
  if (word.length < 2) {
    throw new KeywordValidationError("Keyword minimum 2 karakter")
  }
  if (word.length > 100) {
    throw new KeywordValidationError("Keyword maksimum 100 karakter")
  }
  return word
}

export function applyMockAddKeyword(rawWord: string): KeywordResponse {
  const word = validateKeyword(rawWord)
  const existing = mockKeywordsState.find(
    (kw) => kw.word.toLowerCase() === word.toLowerCase(),
  )
  if (existing) {
    throw new KeywordValidationError(`Keyword "${existing.word}" sudah ada`)
  }
  const newKeyword: KeywordResponse = {
    id: `kw-custom-${Math.random().toString(16).slice(2, 8)}`,
    word,
    category: "custom",
    active: true,
    created_at: new Date().toISOString(),
  }
  mockKeywordsState = [...mockKeywordsState, newKeyword]
  return { ...newKeyword }
}

export function applyMockToggleKeyword(id: string): KeywordResponse {
  const target = mockKeywordsState.find((kw) => kw.id === id)
  if (!target) {
    throw new KeywordValidationError(`Keyword ${id} tidak ditemukan`)
  }
  target.active = !target.active
  return { ...target }
}

export function applyMockDeleteKeyword(id: string): void {
  const target = mockKeywordsState.find((kw) => kw.id === id)
  if (!target) {
    throw new KeywordValidationError(`Keyword ${id} tidak ditemukan`)
  }
  if (target.category === "default") {
    throw new KeywordValidationError(
      "Keyword default tidak dapat dihapus, hanya bisa dinonaktifkan",
    )
  }
  mockKeywordsState = mockKeywordsState.filter((kw) => kw.id !== id)
}

export function __resetMockKeywords(): void {
  mockKeywordsState = initialKeywords.map((kw) => ({ ...kw }))
}
