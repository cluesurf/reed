// SPDX-License-Identifier: GPL-3.0-or-later

import { definePhonology } from '@/api/define-phonology'

/**
 * Standard (Putonghua / Beijing-based) Mandarin Chinese
 * phonology.
 *
 * Initial consonants (21):
 *
 *   Stops/affricates contrast aspirated × unaspirated
 *   (no voicing contrast in Mandarin):
 *     /p pʰ/      → `p ph~`
 *     /t tʰ/      → `t th~`
 *     /k kʰ/      → `k kh~`
 *     /ts tsʰ/    → `tx txh~`
 *     /tʂ tʂʰ/    → `j ch`        (Mandarin uses these as
 *                                  retroflex affricates,
 *                                  but Talk doesn't have a
 *                                  retroflex-affricate
 *                                  symbol so we co-opt
 *                                  the postalveolar ones)
 *     /tɕ tɕʰ/    → mapped to `j ch` w/ palatalization
 *                  (lost in this v0 spec; rules later)
 *
 *   Fricatives: /f s ʂ ɕ x h/ → `f s sh x x h`
 *   Nasals: /m n ŋ/           → `m n q`
 *   Liquid: /l/               → `l`
 *   Approximants: /w j ɻ/     → `w y r`
 *
 * Final segments: 8 monophthong vowels and a handful of
 * diphthongs / triphthongs, plus nasal codas /n ŋ/.
 *
 *   /a o ɤ e i u y ɚ/ → `a o O e i u U @`
 *
 * Tones (the four phonemic tones plus the neutral tone)
 * are expressed via Talk tone marks in surface forms
 * (`+`, `/`, `\\/`, `\\`); the phonology only carries
 * the segmental inventory.
 *
 * As elsewhere, aspirated / retroflex / palatalized
 * variants share base Talk glyphs with their plain
 * counterparts. Allophonic splits happen later via the
 * rule engine.
 *
 * Sources: Duanmu 2007, "The Phonology of Standard
 * Chinese"; PHOIBLE inventory CMN.
 */

export const mandarin = definePhonology({
  name: 'mandarin',
  phones: [
    // Plosives
    'p', 't', 'k',
    // Affricates
    'tx', 'j', 'ch',
    // Fricatives
    'f', 's', 'sh', 'x', 'h',
    // Nasals
    'm', 'n', 'q',
    // Liquid + approximants
    'l', 'r', 'w', 'y',
    // Vowels
    'a', 'e', 'i', 'o', 'u', 'O', 'U', '@',
  ],
})
