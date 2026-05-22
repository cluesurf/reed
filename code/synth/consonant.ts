// SPDX-License-Identifier: GPL-3.0-or-later

import {
  synthesizeFormantCv,
  type SynthesizeFormantCvInput,
} from '@/synth/formant-synth'

/**
 * Top-level CV-syllable renderer.
 *
 * As of the formant-synthesis pivot, this delegates to
 * `synthesizeFormantCv` — a Klatt-style source + parallel-
 * cascade formant filter bank. Formant trajectories are
 * specified directly in Hz per consonant from acoustic
 * phonetics literature, rather than emerging from a
 * physical articulator simulation.
 *
 * Rationale + research background in
 * `note/library/reed/formant-synthesis-pivot.md`.
 *
 * The earlier articulatory consonant synth
 * (`synthesizeArticulatoryCv`) remains in the codebase
 * for reference and future research but is no longer the
 * default rendering path.
 */

export type SynthesizeConsonantVowelInput = SynthesizeFormantCvInput

export function synthesizeConsonantVowel(
  input: SynthesizeConsonantVowelInput,
): Float32Array {
  return synthesizeFormantCv(input)
}
