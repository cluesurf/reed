// SPDX-License-Identifier: GPL-3.0-or-later

import type { Phone } from '@/types/phone'

/**
 * A complete phonology specification for one language.
 * Currently a minimal scaffold; rules, syllable patterns,
 * and stress rules fill in as subsequent subsystems land.
 *
 * `phones` is the language's phoneme inventory expressed
 * as a flat list of Talk glyph strings. Reed resolves each
 * to its full `Phone` via talk.js's lookup tables at
 * `definePhonology` time.
 */

export type Phonology = {
  name: string
  phones: Phone[]
}

/**
 * User-facing spec for `definePhonology`. Accepts:
 *   - `phones: string[]` — Talk glyph strings, looked up.
 *   - `phones: Phone[]` — pre-built Phone objects.
 */

export type PhonologySpec = {
  name: string
  phones: ReadonlyArray<string | Phone>
}
