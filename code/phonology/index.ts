// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Registry of pre-canned phonologies that reed ships.
 *
 * Keyed by ISO 639-1 code. Each entry is the canonical
 * "broad" phonemic inventory for that language —
 * sufficient for parsing Talk input written by a fluent
 * speaker. Allophonic variants emerge from the rule
 * engine (future phase), not from the inventory itself.
 *
 * v1 baseline: en + es + ar + hi + zh. These five cover
 * the dominant phonological feature space: tone (zh),
 * pharyngeals (ar), retroflex + aspiration (hi), simple
 * inventory (es), and the workhorse English starting
 * point (en).
 *
 * See `note/library/reed/plan/phonologies.md` for the
 * v1.5 expansion plan to 24 languages.
 */

import { english } from '@/phonology/english'
import { spanish } from '@/phonology/spanish'
import { arabic } from '@/phonology/arabic'
import { hindi } from '@/phonology/hindi'
import { mandarin } from '@/phonology/mandarin'
import type { Phonology } from '@/types/phonology'

export const PHONOLOGIES: Record<string, Phonology> = Object.freeze({
  en: english,
  es: spanish,
  ar: arabic,
  hi: hindi,
  zh: mandarin,
})

export { english } from '@/phonology/english'
export { spanish } from '@/phonology/spanish'
export { arabic } from '@/phonology/arabic'
export { hindi } from '@/phonology/hindi'
export { mandarin } from '@/phonology/mandarin'
