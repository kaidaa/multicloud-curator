import { simulateDelay } from "@/shared/api/mocks/accounts"
import {
  applyMockAddKeyword,
  applyMockDeleteKeyword,
  applyMockToggleKeyword,
  getMockKeywords,
  KeywordValidationError,
  type KeywordResponse,
} from "@/shared/api/mocks/keywords"

export { KeywordValidationError }

export type KeywordCategory = "default" | "custom"

export interface Keyword {
  id: string
  word: string
  category: KeywordCategory
  active: boolean
  createdAt: string
}

function mapKeyword(raw: KeywordResponse): Keyword {
  return {
    id: raw.id,
    word: raw.word,
    category: raw.category,
    active: raw.active,
    createdAt: raw.created_at,
  }
}

// M4: replace dengan `api.get<KeywordResponse[]>('/keywords')`.
export async function listKeywords(): Promise<Keyword[]> {
  await simulateDelay(400)
  return getMockKeywords().map(mapKeyword)
}

// M4: replace dengan `api.post('/keywords', { word })`. Validation di backend
// match logika di mock (min 2 char, max 100, unique case-insensitive).
export async function addKeyword(word: string): Promise<Keyword> {
  await simulateDelay(400)
  return mapKeyword(applyMockAddKeyword(word))
}

// M4: replace dengan `api.patch('/keywords/{id}/toggle')`.
export async function toggleKeyword(id: string): Promise<Keyword> {
  await simulateDelay(300)
  return mapKeyword(applyMockToggleKeyword(id))
}

// M4: replace dengan `api.delete('/keywords/{id}')`. Backend tolak default
// dengan ValidationError.
export async function deleteKeyword(id: string): Promise<void> {
  await simulateDelay(400)
  applyMockDeleteKeyword(id)
}
