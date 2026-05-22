// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * A single speech sound in reed's intermediate representation.
 *
 * `talk` is the canonical Talk glyph (e.g. 'p', 'sh', 'A',
 * '@'). `features` is the structured phonetic descriptor
 * derived from talk.js's existing CONSONANTS / VOWELS
 * tables, augmented with any modifier marks present in the
 * source (aspiration, nasalization, tone, etc.).
 *
 * The `source` offsets are UTF-16 code-unit indices into the
 * original input string. They survive every pipeline stage
 * so editor surfaces can highlight the span that produced
 * any given downstream artifact (waveform region, error,
 * articulator position).
 */

export type Phone = {
  talk: string
  raw: string
  features: PhoneFeatures
  source: SourceSpan
}

export type SourceSpan = {
  start: number
  end: number
}

/**
 * Structured phonetic features. Tonal info lives on
 * `tone`; per-segment durational marks on `long` / `short`
 * / `geminated`. The layout intentionally mirrors talk.js's
 * vocabulary so the adapter from talk.js Cluster + Mark to
 * reed Phone is a near-identity.
 */

export type PhoneFeatures = {
  kind: 'consonant' | 'vowel'

  // From talk.js's CONSONANTS / VOWELS feature tables.
  site?: ConsonantSite
  mold?: ConsonantMold
  height?: VowelHeight
  backness?: VowelBackness
  rounded?: boolean

  // From talk.js Mark annotations carried on the cluster.
  aspirated?: boolean
  voiced?: boolean
  voiceless?: boolean
  ejective?: boolean
  implosive?: boolean
  click?: boolean
  labialized?: boolean
  palatalized?: boolean
  velarized?: boolean
  pharyngealized?: boolean
  retroflex?: boolean
  dentalized?: boolean
  nasalized?: boolean
  tense?: boolean
  stop?: boolean
  trill?: boolean

  // Durational features.
  long?: boolean
  short?: boolean
  geminated?: boolean

  // From Talk's `@` mark; the consonant acts as a syllable
  // nucleus (e.g. the second syllable of English 'button'
  // has /n/ as nucleus).
  syllabic?: boolean

  // Tonal marking, if present.
  tone?: ToneMark
}

export type ConsonantSite =
  | 'bilabial'
  | 'labiodental'
  | 'dental'
  | 'alveolar'
  | 'postalveolar'
  | 'retroflex'
  | 'palatal'
  | 'velar'
  | 'uvular'
  | 'pharyngeal'
  | 'glottal'
  | 'click'

export type ConsonantMold =
  | 'plosive'
  | 'nasal'
  | 'fricative'
  | 'sibilant'
  | 'sibilant-fricative'
  | 'affricate'
  | 'approximant'
  | 'lateral-approximant'
  | 'lateral-fricative'
  | 'tap'
  | 'trill'

export type VowelHeight =
  | 'close'
  | 'near-close'
  | 'close-mid'
  | 'mid'
  | 'open-mid'
  | 'near-open'
  | 'open'

export type VowelBackness = 'front' | 'central' | 'back'

export type ToneMark =
  | 'extra-high'
  | 'high'
  | 'low'
  | 'extra-low'
  | 'rising'
  | 'rising-2'
  | 'falling'
  | 'falling-2'
  | 'rising-falling'
  | 'falling-rising'
