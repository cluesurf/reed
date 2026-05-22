// SPDX-License-Identifier: GPL-3.0-or-later

import { definePhonology } from '@/api/define-phonology'

/**
 * Latin American Spanish phonology.
 *
 * Inventory choices reflect the standard "neutral" Latin
 * American variety:
 *
 *   - 5 simple vowels: /a e i o u/. No phonemic length;
 *     no diphthongs as separate phonemes (they fall out
 *     of vowel + glide sequences).
 *   - 17 consonants: stops /p b t d k g/, nasals /m n/,
 *     fricatives /f s x/ (the last is the jota), the
 *     affricate /tʃ/ (`ch` in Talk), liquids /r l/, and
 *     glides /w j/.
 *   - No /θ/ (Castilian distinction is omitted).
 *   - No phonemic /ɲ/ (Spanish ñ); allophonic via a
 *     palatalized /n/ rule when the rule engine lands.
 *
 * Sources: Hualde 2014, "The Sounds of Spanish"; Ladefoged
 * & Maddieson 1996 cross-referenced against the standard
 * Real Academia phoneme inventory.
 */

export const spanish = definePhonology({
  name: 'spanish',
  phones: [
    // Plosives
    'p', 'b', 't', 'd', 'k', 'g',
    // Nasals
    'm', 'n',
    // Fricatives
    'f', 's', 'x', 'h',
    // Affricate
    'ch',
    // Approximants + liquids
    'l', 'r', 'w', 'y',
    // Vowels
    'a', 'e', 'i', 'o', 'u',
  ],
})
