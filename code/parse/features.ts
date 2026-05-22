// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ConsonantMold,
  ConsonantSite,
  PhoneFeatures,
  ToneMark,
  VowelBackness,
  VowelHeight,
} from '@/types/phone'

/**
 * Derive `PhoneFeatures` from a base Talk glyph plus a set
 * of mark modifiers.
 *
 * The lookup tables below cover every base symbol on the
 * IPA pulmonic chart + non-pulmonic clicks/implosives/
 * ejectives + the full IPA vowel chart. Modifier marks
 * (`h~`, `w~`, `y~`, `G~`, `Q~`, `R~`, `!`, `&`, `_`,
 * `@`, tone marks) layer additional features on top.
 *
 * Full mapping doc: note/library/reed/talk-ipa-mapping.md.
 */

export type ModifierFlags = {
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
  long?: boolean
  short?: boolean
  syllabic?: boolean
  tone?: ToneMark
}

export function deriveFeatures(input: {
  glyph: string
  modifiers: ModifierFlags
}): PhoneFeatures {
  const { glyph, modifiers } = input
  const vowelEntry = VOWEL_TABLE[glyph]
  const consonantEntry = CONSONANT_TABLE[glyph]

  if (vowelEntry) {
    return {
      kind: 'vowel',
      height: vowelEntry.height,
      backness: vowelEntry.backness,
      rounded: vowelEntry.rounded ?? false,
      ...modifiers,
    }
  }

  if (consonantEntry) {
    return {
      kind: 'consonant',
      site: consonantEntry.site,
      mold: consonantEntry.mold,
      voiced: consonantEntry.voiced,
      ...modifiers,
    }
  }

  // Fallback: best-effort vowel-vs-consonant guess.
  if (/^[aeiouAEIOU@]+$/.test(glyph)) {
    return { kind: 'vowel', ...modifiers }
  }
  return { kind: 'consonant', ...modifiers }
}

type VowelEntry = {
  height: VowelHeight
  backness: VowelBackness
  rounded?: boolean
}

type ConsonantEntry = {
  site: ConsonantSite
  mold: ConsonantMold
  voiced?: boolean
}

/**
 * Full IPA vowel chart.
 *
 * Talk uses lowercase for the primary 5 cardinal vowels
 * (a/e/i/o/u) and uppercase for the "shifted" lax / open
 * variants (English /æ/, /ɛ/, /ɪ/, etc.). The schwa is
 * `@`. Central + rounded vowels that don't have natural
 * base-letter homes are derived via modifiers (`w~`,
 * `G~`) per the mapping doc.
 */

const VOWEL_TABLE: Record<string, VowelEntry> = {
  // Close (high)
  i: { height: 'close', backness: 'front' },
  I: { height: 'near-close', backness: 'front' },
  u: { height: 'close', backness: 'back', rounded: true },
  U: { height: 'near-close', backness: 'back', rounded: true },
  // Close-mid
  e: { height: 'close-mid', backness: 'front' },
  o: { height: 'close-mid', backness: 'back', rounded: true },
  // Open-mid
  E: { height: 'open-mid', backness: 'front' },
  O: { height: 'open-mid', backness: 'back', rounded: true },
  // Open
  a: { height: 'open', backness: 'central' },
  A: { height: 'near-open', backness: 'front' },
  // Mid central (schwa)
  '@': { height: 'mid', backness: 'central' },
}

/**
 * Full IPA consonant chart — both pulmonic and (via
 * special glyphs / modifiers) non-pulmonic.
 *
 * Rows track place (bilabial → glottal), columns track
 * manner (plosive → approximant). `voiced` defaults to
 * the unmarked language norm (true for nasals, laterals,
 * approximants, taps, trills; false for plosives,
 * fricatives, affricates unless the IPA symbol denotes a
 * voiced variant).
 */

const CONSONANT_TABLE: Record<string, ConsonantEntry> = {
  // Bilabial
  p: { site: 'bilabial', mold: 'plosive', voiced: false },
  b: { site: 'bilabial', mold: 'plosive', voiced: true },
  m: { site: 'bilabial', mold: 'nasal', voiced: true },
  F: { site: 'bilabial', mold: 'fricative', voiced: false }, // /ɸ/
  B: { site: 'bilabial', mold: 'fricative', voiced: true }, // /β/
  // Labiodental
  M: { site: 'labiodental', mold: 'nasal', voiced: true }, // /ɱ/
  f: { site: 'labiodental', mold: 'fricative', voiced: false },
  v: { site: 'labiodental', mold: 'fricative', voiced: true },
  V: { site: 'labiodental', mold: 'approximant', voiced: true }, // /ʋ/
  // Dental
  T: { site: 'dental', mold: 'fricative', voiced: false }, // /θ/
  D: { site: 'dental', mold: 'fricative', voiced: true }, // /ð/
  // Alveolar
  t: { site: 'alveolar', mold: 'plosive', voiced: false },
  d: { site: 'alveolar', mold: 'plosive', voiced: true },
  n: { site: 'alveolar', mold: 'nasal', voiced: true },
  s: { site: 'alveolar', mold: 'sibilant', voiced: false },
  z: { site: 'alveolar', mold: 'sibilant', voiced: true },
  l: { site: 'alveolar', mold: 'lateral-approximant', voiced: true },
  r: { site: 'alveolar', mold: 'trill', voiced: true },
  // Postalveolar
  sh: { site: 'postalveolar', mold: 'sibilant', voiced: false }, // /ʃ/
  zh: { site: 'postalveolar', mold: 'sibilant', voiced: true }, // /ʒ/
  ch: { site: 'postalveolar', mold: 'affricate', voiced: false }, // /tʃ/
  j: { site: 'postalveolar', mold: 'affricate', voiced: true }, // /dʒ/
  // Alveolar affricates
  tx: { site: 'alveolar', mold: 'affricate', voiced: false }, // /ts/
  dj: { site: 'alveolar', mold: 'affricate', voiced: true }, // /dz/
  // Palatal
  c: { site: 'palatal', mold: 'plosive', voiced: false }, // /c/
  J: { site: 'palatal', mold: 'plosive', voiced: true }, // /ɟ/
  N: { site: 'palatal', mold: 'nasal', voiced: true }, // /ɲ/
  C: { site: 'palatal', mold: 'fricative', voiced: false }, // /ç/
  Z: { site: 'palatal', mold: 'fricative', voiced: true }, // /ʝ/
  y: { site: 'palatal', mold: 'approximant', voiced: true }, // /j/
  L: { site: 'palatal', mold: 'lateral-approximant', voiced: true }, // /ʎ/
  // Velar
  k: { site: 'velar', mold: 'plosive', voiced: false },
  g: { site: 'velar', mold: 'plosive', voiced: true },
  q: { site: 'velar', mold: 'nasal', voiced: true }, // /ŋ/ (Talk convention)
  x: { site: 'velar', mold: 'fricative', voiced: false }, // /x/
  G: { site: 'velar', mold: 'fricative', voiced: true }, // /ɣ/
  w: { site: 'velar', mold: 'approximant', voiced: true }, // /w/ (labio-velar but encoded here)
  // Uvular
  K: { site: 'uvular', mold: 'plosive', voiced: false }, // /q/
  X: { site: 'uvular', mold: 'fricative', voiced: false }, // /χ/
  R: { site: 'uvular', mold: 'trill', voiced: true }, // /ʀ/
  // Pharyngeal
  H: { site: 'pharyngeal', mold: 'fricative', voiced: false }, // /ħ/
  Q: { site: 'pharyngeal', mold: 'fricative', voiced: true }, // /ʕ/
  // Glottal
  h: { site: 'glottal', mold: 'fricative', voiced: false }, // /h/
  "'": { site: 'glottal', mold: 'plosive', voiced: false }, // /ʔ/
}
