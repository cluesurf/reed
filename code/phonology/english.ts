// SPDX-License-Identifier: GPL-3.0-or-later

import { definePhonology } from '@/api/define-phonology'

/**
 * Standard General American English phonology.
 *
 * Inventory uses Talk's ASCII representation:
 *   Consonants: p b t d k g, m n q (for /ŋ/), f v T D
 *     (for /θ ð/), s z sh zh, ch j, h l r w y.
 *   Vowels: i I e E a A o O u U @ (for /ə/).
 *
 * Diphthongs are not separate phonemes here; they appear
 * as sequences of vowels in the phone stream (e.g. /ai/
 * in 'eye' is `a` + `i` and the syllabifier collapses the
 * two into a single nucleus).
 *
 * v0: just the inventory. Syllable pattern, allophonic
 * rules, and stress rules land with their subsystems.
 *
 * Source notes:
 *   - 24-consonant inventory per Ladefoged & Maddieson
 *     (1996).
 *   - 14-vowel inventory simplified to monophthong cores;
 *     diphthongs derived from vowel sequences.
 *   - Talk glyph mapping per `@cluesurf/talk` features.ts.
 */

export const english = definePhonology({
  name: 'english',
  phones: [
    // Plosives
    'p', 'b', 't', 'd', 'k', 'g',
    // Nasals
    'm', 'n', 'q',
    // Fricatives
    'f', 'v', 'T', 'D', 's', 'z', 'sh', 'zh', 'h',
    // Affricates
    'ch', 'j',
    // Approximants
    'l', 'r', 'w', 'y',
    // Vowels
    'i', 'I', 'e', 'E', 'a', 'A', 'o', 'O', 'u', 'U', '@',
  ],
})
