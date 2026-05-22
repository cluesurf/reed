// SPDX-License-Identifier: GPL-3.0-or-later

import {
  synthesizeKlattCv,
  type SynthesizeKlattCvInput,
} from '@/synth/klatt-synth'

/**
 * Top-level CV-syllable renderer.
 *
 * Implements the full Klatt 1980 synthesizer:
 * cascade + parallel formant banks + anti-resonators +
 * 6-amplitude source. Rationale and parameter tables
 * documented in
 * `note/library/reed/consonant-synthesis-research-plan.md`.
 *
 * Earlier synth backends (`synthesizeArticulatoryCv`,
 * `synthesizeFormantCv`) remain in the codebase as
 * reference implementations.
 */

export type SynthesizeConsonantVowelInput = SynthesizeKlattCvInput

export function synthesizeConsonantVowel(
  input: SynthesizeConsonantVowelInput,
): Float32Array {
  return synthesizeKlattCv(input)
}
