// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * @cluesurf/reed — articulatory speech synthesis library.
 *
 * Pure TypeScript. Browser + Node.
 *
 * The top-level userland surface. See `note/library/reed/`
 * in the cluesurf monorepo for the design + implementation
 * plan.
 *
 * v0 ships:
 *   - The core types (`Phone`, `Word`, `Syllable`,
 *     `Utterance`, etc.).
 *   - `parse(input, options)` — Talk ASCII → Utterance[],
 *     with optional phonology validation.
 *   - `definePhonology(spec)` — build a phonology from a
 *     declarative spec.
 *   - Pre-canned phonologies (currently: English).
 *
 * Subsequent versions add allophonic rules, gestures,
 * task-dynamics, the articulatory synth, and the full
 * `speak()` / `synthesize()` / `articulate()` surface.
 */

export { parse, ReedParseError, type ParseOptions } from '@/parse'
export { definePhonology } from '@/api/define-phonology'
export {
  PHONOLOGIES,
  english,
  spanish,
  arabic,
  hindi,
  mandarin,
} from '@/phonology'
export {
  synthesizeVowel,
  synthesizeConsonantVowel,
  Glottis,
  Tract,
  vowelDiameters,
  encodeWav,
  type VowelKey,
  type SynthesizeVowelInput,
  type SynthesizeConsonantVowelInput,
} from '@/synth'
export type * from '@/types'
