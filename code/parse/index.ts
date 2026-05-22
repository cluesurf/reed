// SPDX-License-Identifier: GPL-3.0-or-later

import type { Phonology } from '@/types/phonology'
import type { Utterance } from '@/types/utterance'
import { tokenize } from '@/parse/tokenize'
import { groupIntoUtterances } from '@/parse/group'
import {
  validateUtterances,
  type UnknownPhoneBehavior,
} from '@/parse/validate'

/**
 * Parse a Talk ASCII string into a sequence of utterances
 * with source-offset tracking.
 *
 * v1 behavior:
 *   - Accepts Talk ASCII only (Simplified form rejected).
 *   - Mark order is fixed per talk.js convention.
 *   - Whitespace runs collapse to word boundaries.
 *   - `,`, `;`, `:` attach to preceding word as prosodic
 *     boundaries.
 *   - `.`, `?`, `!` close the current utterance and set
 *     the intonation.
 *   - When `options.phonology` is set, every phone is
 *     verified against the phonology's inventory. Behavior
 *     on unknown phones controlled by
 *     `options.onUnknownPhone` (default: 'throw').
 *
 * Pure function. No side effects.
 */

export type ParseOptions = {
  phonology?: Phonology
  /**
   * What to do when a parsed phone isn't in the
   * phonology's inventory.
   *
   *   - 'throw' (default): raise ReedParseError.
   *   - 'warn': console.warn, mark the phone
   *             `features.foreign = true`, continue.
   *   - 'ignore': pass through silently.
   *
   * Has no effect when `phonology` is absent.
   */
  onUnknownPhone?: UnknownPhoneBehavior
}

export function parse(input: string, options?: ParseOptions): Utterance[] {
  const tokens = tokenize(input)
  const utterances = groupIntoUtterances(tokens)
  if (options?.phonology) {
    return validateUtterances({
      utterances,
      phonology: options.phonology,
      onUnknownPhone: options.onUnknownPhone ?? 'throw',
    })
  }
  return utterances
}

export { ReedParseError } from '@/parse/errors'
