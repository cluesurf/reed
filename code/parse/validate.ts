// SPDX-License-Identifier: GPL-3.0-or-later

import type { Phone } from '@/types/phone'
import type { Phonology } from '@/types/phonology'
import type { Utterance } from '@/types/utterance'
import { ReedParseError } from '@/parse/errors'

export type UnknownPhoneBehavior = 'throw' | 'warn' | 'ignore'

/**
 * Walk every Phone in every Utterance and check it's in
 * the phonology's inventory. The inventory is a list of
 * Phones keyed by `talk` string.
 *
 * Behavior per mode:
 *   - 'throw' (default): raise ReedParseError with the
 *     offending phone's source offset.
 *   - 'warn': console.warn and continue, tagging the
 *     phone with `features.foreign = true`.
 *   - 'ignore': pass through silently.
 *
 * The function returns the same `Utterance[]` shape;
 * phones are mutated in place when tagging `foreign`
 * since the rest of the structure is otherwise unchanged.
 */

export function validateUtterances(input: {
  utterances: Utterance[]
  phonology: Phonology
  onUnknownPhone: UnknownPhoneBehavior
}): Utterance[] {
  const { utterances, phonology, onUnknownPhone } = input
  if (onUnknownPhone === 'ignore') return utterances

  const inventory = buildInventoryIndex(phonology)

  for (const utterance of utterances) {
    for (const word of utterance.words) {
      for (const syllable of word.syllables) {
        for (const phone of [
          ...syllable.onset,
          ...syllable.nucleus,
          ...syllable.coda,
        ]) {
          if (inventory.has(phone.talk)) continue
          if (onUnknownPhone === 'throw') {
            throw new ReedParseError({
              code: 'phone-not-in-phonology',
              message: `phone ${JSON.stringify(phone.talk)} at offset ${phone.source.start} is not in the '${phonology.name}' phonology inventory`,
              offset: phone.source.start,
            })
          }
          if (onUnknownPhone === 'warn') {
            console.warn(
              `[reed.parse] phone '${phone.talk}' at offset ${phone.source.start} is not in '${phonology.name}' phonology; marking foreign`,
            )
            ;(phone.features as Phone['features'] & { foreign?: boolean }).foreign = true
          }
        }
      }
    }
  }

  return utterances
}

function buildInventoryIndex(phonology: Phonology): Set<string> {
  return new Set(phonology.phones.map(p => p.talk))
}
