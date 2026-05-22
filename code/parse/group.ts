// SPDX-License-Identifier: GPL-3.0-or-later

import type { Phone } from '@/types/phone'
import type { Utterance, Word } from '@/types/utterance'
import { syllabifyDefault } from '@/parse/syllabify'
import type { Token } from '@/parse/tokenize'

/**
 * Group a `Token[]` (from the tokenizer) into a
 * `Utterance[]`.
 *
 * Steps:
 *   1. Slice the token stream on `word-boundary`s to get
 *      per-word phone buckets.
 *   2. Syllabify each bucket via `syllabifyDefault`.
 *   3. Attach intra-utterance `prosodic-boundary` marks
 *      (commas, semicolons, colons) to the preceding word
 *      as `trailingPunctuation`.
 *   4. Slice on `utterance-end` to get utterances; set the
 *      `intonation` field from the terminator.
 *   5. If the stream ends without a terminator, close the
 *      final utterance as declarative.
 */

export function groupIntoUtterances(tokens: Token[]): Utterance[] {
  const utterances: Utterance[] = []
  let pendingWords: Word[] = []
  let pendingPhones: Phone[] = []

  const flushWord = () => {
    if (pendingPhones.length === 0) return
    const syllables = syllabifyDefault(pendingPhones)
    if (syllables.length === 0) {
      pendingPhones = []
      return
    }
    const start = syllables[0]!.source.start
    const end = syllables[syllables.length - 1]!.source.end
    pendingWords.push({
      syllables,
      source: { start, end },
    })
    pendingPhones = []
  }

  const flushUtterance = (
    intonation: Utterance['intonation'],
    closingOffset: number,
  ) => {
    flushWord()
    if (pendingWords.length === 0) return
    const start = pendingWords[0]!.source.start
    const end =
      closingOffset > 0
        ? closingOffset
        : pendingWords[pendingWords.length - 1]!.source.end
    utterances.push({
      words: pendingWords,
      intonation,
      source: { start, end },
    })
    pendingWords = []
  }

  for (const token of tokens) {
    switch (token.kind) {
      case 'phone':
        pendingPhones.push(token.phone)
        break
      case 'word-boundary':
        flushWord()
        break
      case 'prosodic-boundary':
        flushWord()
        // Attach the mark to the most recent word as
        // trailingPunctuation. If there's no word yet,
        // silently drop it (Talk shouldn't lead with a
        // comma).
        if (pendingWords.length > 0) {
          const last = pendingWords[pendingWords.length - 1]!
          pendingWords[pendingWords.length - 1] = {
            ...last,
            trailingPunctuation: token.mark,
          }
        }
        break
      case 'utterance-end':
        flushUtterance(
          intonationFromTerminator(token.terminator),
          token.source.end,
        )
        break
    }
  }

  // Trailing content without a terminator → declarative.
  flushUtterance('declarative', 0)

  return utterances
}

function intonationFromTerminator(t: '.' | '?' | '!'): Utterance['intonation'] {
  if (t === '?') return 'interrogative'
  if (t === '!') return 'exclamative'
  return 'declarative'
}
