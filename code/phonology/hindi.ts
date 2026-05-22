// SPDX-License-Identifier: GPL-3.0-or-later

import { definePhonology } from '@/api/define-phonology'

/**
 * Standard (Khariboli-based) Hindi phonology.
 *
 * Three-way stop contrast in MANNER (voiceless × voiced
 * × aspirated × breathy-voiced) and four-way contrast in
 * PLACE (labial × dental × retroflex × velar) is the
 * defining feature of the consonant inventory. Plus the
 * palatal affricate series.
 *
 * Talk glyph choices for the four-way contrast:
 *
 *   Plosives: bilabial: /p b pʰ bʱ/ → `p b ph~ bh~`
 *   Dentals:                /t̪ d̪ t̪ʰ d̪ʱ/ → `t d th~ dh~`
 *   Retroflexes:    /ʈ ɖ ʈʰ ɖʱ/ → `t. d. th~. dh~.`
 *   Velars:                  /k g kʰ gʱ/ → `k g kh~ gh~`
 *   Affricates: /c ɟ cʰ ɟʱ/  → `ch j chh~ jh~`
 *
 * Aspiration uses Talk's standard `h~` modifier.
 * Retroflexion uses `.` (the Talk modifier for retroflex
 * place). Breathy voicing uses both `h~` (aspiration) +
 * voicing (the base is already voiced).
 *
 * The phonology lists ONLY the unique base glyphs.
 * Aspirated / breathy variants share base glyphs with
 * their plain counterparts and live as feature
 * variations. The rule engine (future phase) splits them
 * back into surface allophones.
 *
 * Vowel inventory: /a aː i iː u uː e ɛ o ɔ ɛ̃ ə/ — eleven
 * monophthongs plus length distinction. Listed as the
 * five base qualities; length comes from `_`.
 *
 * Sources: Ohala 1983, "Aspects of Hindi Phonology";
 * PHOIBLE inventory HIN.
 */

export const hindi = definePhonology({
  name: 'hindi',
  phones: [
    // Plosives (bilabial + dental + retroflex + velar)
    'p', 'b', 't', 'd', 'k', 'g',
    // Palatal affricates
    'ch', 'j',
    // Nasals
    'm', 'n',
    // Fricatives
    's', 'sh', 'h', 'f',
    // Liquids + flaps
    'l', 'r',
    // Glides
    'w', 'y',
    // Vowels
    'a', 'e', 'i', 'o', 'u', '@',
  ],
})
