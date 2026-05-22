// SPDX-License-Identifier: GPL-3.0-or-later

import { definePhonology } from '@/api/define-phonology'

/**
 * Modern Standard Arabic phonology.
 *
 * Covers the canonical 28 consonants plus 3 vowel
 * qualities. Talk glyph choices:
 *
 *   - /θ/ → `T`         (capital T = dental fricative)
 *   - /ð/ → `D`         (capital D)
 *   - /ʃ/ → `sh`        (digraph)
 *   - /dʒ/ → `j`        (Talk's affricate /dʒ/)
 *   - /ħ/ → `H`         (capital H = voiceless pharyngeal)
 *   - /x/ → `x`         (voiceless velar/uvular fricative)
 *   - /ɣ/ → `G`         (capital G = voiced velar fricative)
 *   - /ʕ/ → `Q`         (capital Q = voiced pharyngeal)
 *   - /q/ → `K`         (capital K = uvular plosive, distinct from velar /k/)
 *
 * Vowels: /a i u/ as base. Phonemic length (/aː iː uː/)
 * is derived via the `_` modifier in surface forms; the
 * phonology only lists the three vowel qualities.
 *
 * Emphatics (/sˤ tˤ dˤ ðˤ/) are not separately listed
 * either — they share Talk base glyphs with their plain
 * counterparts and the pharyngealization feature is
 * applied via the `Q~` modifier in surface forms. The
 * rule engine (future phase) handles the allophony.
 *
 * Sources: Watson 2002, "The Phonology and Morphology of
 * Arabic"; PHOIBLE inventory ARB.
 */

export const arabic = definePhonology({
  name: 'arabic',
  phones: [
    // Plosives
    'b', 't', 'd', 'k', 'K',
    // Fricatives (interdentals + sibilants + dorsals + pharyngeals)
    'T', 'D', 's', 'z', 'sh', 'x', 'G', 'H', 'Q', 'f', 'h',
    // Affricate
    'j',
    // Nasals
    'm', 'n',
    // Liquids
    'l', 'r',
    // Glides
    'w', 'y',
    // Vowels
    'a', 'i', 'u',
  ],
})
