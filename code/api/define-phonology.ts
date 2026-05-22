// SPDX-License-Identifier: GPL-3.0-or-later

import type { Phone } from '@/types/phone'
import type { Phonology, PhonologySpec } from '@/types/phonology'
import { deriveFeatures } from '@/parse/features'

/**
 * Build a `Phonology` from a declarative spec.
 *
 * Accepts:
 *   - `phones: string[]` — Talk glyph strings; each is
 *     looked up via `deriveFeatures` to produce a `Phone`
 *     with structured features.
 *   - `phones: Phone[]` — pre-built Phones used as-is.
 *   - Mixed arrays of both.
 *
 * The returned Phonology is frozen (shallow + per-phone)
 * so consumers can't mutate the inventory by accident.
 *
 * In v0 this is the only field beyond `name`. Subsequent
 * phases extend the spec with syllable patterns, rules,
 * stress rules, etc.
 */

export function definePhonology(spec: PhonologySpec): Phonology {
  const phones = spec.phones.map(entry => normalizePhoneEntry(entry))
  return Object.freeze({
    name: spec.name,
    phones: Object.freeze(phones) as ReadonlyArray<Phone> as Phone[],
  })
}

function normalizePhoneEntry(entry: string | Phone): Phone {
  if (typeof entry !== 'string') return Object.freeze({ ...entry })
  // A talk glyph string. Synthesize a minimal Phone whose
  // source offsets are zero (since it doesn't come from a
  // parsed string). Downstream consumers look up by
  // `talk` field; offsets are only meaningful for parsed
  // phones, not inventory entries.
  return Object.freeze({
    talk: entry,
    raw: entry,
    features: deriveFeatures({ glyph: entry, modifiers: {} }),
    source: { start: 0, end: entry.length },
  })
}
