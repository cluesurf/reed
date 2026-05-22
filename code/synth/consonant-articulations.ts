// SPDX-License-Identifier: GPL-3.0-or-later

import type { ConsonantSite, ConsonantMold } from '@/types/phone'

/**
 * Per-consonant articulator targets and timing.
 *
 * A `ConsonantArticulation` describes what the vocal
 * tract should look like when the consonant is at maximum
 * constriction, plus the timing of the closure, release,
 * and voicing onset.
 *
 * The articulatory synth reads these to:
 *
 *   1. Build a time-varying tract diameter trajectory
 *      that morphs from the consonant configuration into
 *      the following vowel.
 *   2. Position the intra-tract noise injection point at
 *      the consonant's constriction segment.
 *   3. Time the glottal source on/off relative to the
 *      release (Voice Onset Time).
 *   4. Time the velum opening for nasals.
 *
 * One profile per Talk base glyph. The CV synth maps
 * `(glyph, vowel)` → trajectory at render time.
 */

export type ConsonantArticulation = {
  /** Base glyph this profile applies to. */
  talk: string
  /** Articulatory site. */
  site: ConsonantSite
  /** Articulatory manner. */
  mold: ConsonantMold
  /** Voicing — whether the glottis runs during the hold. */
  voiced: boolean
  /**
   * Segment index of the primary constriction (0 = glottis,
   * length-1 = lips). Used for:
   *   - Setting that segment to the constriction diameter.
   *   - Positioning the intra-tract noise injection.
   */
  constrictionSegment: number
  /**
   * Diameter at the constriction (cm). 0 = fully closed
   * (stops, nasals during closure). ~0.4 = tight (sibilants).
   * ~0.8 = looser (other fricatives). 1.0+ = approximant.
   */
  constrictionDiameter: number
  /**
   * Half-width of the constriction in segments. The
   * trajectory narrows segments [constrictionSegment -
   * spread, constrictionSegment + spread] toward
   * constrictionDiameter, with smooth falloff at the
   * edges.
   */
  constrictionSpread: number
  /**
   * Hold duration (seconds). For stops this is the
   * closure time; for fricatives the steady-frication
   * time; for approximants the transition lead-in time.
   */
  holdDuration: number
  /**
   * Release duration (seconds). How fast the constriction
   * opens after the hold. Fast for stops (~5 ms), slow
   * for affricates (~80 ms), very slow for approximants
   * (~100 ms).
   */
  releaseDuration: number
  /**
   * Voice Onset Time (seconds). For voiceless stops this
   * is the silent + aspirated gap between release and the
   * start of voicing. Voiced stops have VOT = 0 (or
   * negative — voicing precedes release; not modeled).
   */
  vot: number
  /** Whether the velum is open during the hold (nasals). */
  velumOpen: boolean
  /**
   * Whether frication noise is generated at the
   * constriction during the hold. True for all fricatives
   * and affricates (during the affricate's slow release).
   * False for stops, nasals, approximants.
   */
  hasFrication: boolean
  /**
   * Noise amplitude scaler. Sibilants (/s/, /ʃ/) get
   * loud frication; /h/ gets very quiet frication. Values
   * roughly in [0, 1].
   */
  fricationAmplitude: number
}

/**
 * Approximate segment indices in a 44-segment tract for
 * each IPA articulator location. Calibrated to land in the
 * right zone of the rest profile (segments 0-6 = lower
 * pharynx, 7-11 = upper pharynx, 12-31 = oral cavity, 32-38
 * = front oral, 39-43 = lip area).
 */

const SITE_SEGMENT: Record<ConsonantSite, number> = {
  bilabial: 42,
  labiodental: 41,
  dental: 36,
  alveolar: 33,
  postalveolar: 30,
  retroflex: 31,
  palatal: 27,
  velar: 20,
  uvular: 13,
  pharyngeal: 7,
  glottal: 1,
  click: 33,
}

/**
 * Constriction diameter (cm) defaults by manner.
 *
 *   plosive / stop:      ~0 cm (fully closed)
 *   nasal:               ~0 cm at oral closure + velum open
 *   fricative (sibilant): 0.3 cm
 *   fricative (other):   0.5 cm
 *   affricate:           starts at 0, opens to 0.4 during release
 *   approximant:         1.0 cm (no real constriction)
 *   trill:               periodic between 0 and 1.0
 *   tap:                 brief 0
 */

function defaultConstrictionDiameter(
  mold: ConsonantMold,
  voiced: boolean,
): number {
  // "Closed" stops/nasals use a small non-zero leakage
  // rather than full closure. Real recordings show some
  // residual radiation through the cheeks/skull, and our
  // K-L model loses ALL output when reflection = 1.
  //
  // Voiced stops use MORE leakage than voiceless so the
  // voice bar is actually audible at the lip end. Nasals
  // use even more leakage as a placeholder for the proper
  // nasal-branch waveguide we haven't built yet.
  switch (mold) {
    case 'plosive':
      return voiced ? 0.08 : 0.02
    case 'nasal':
      return 0.35
    case 'sibilant':
      return 0.35
    case 'sibilant-fricative':
      return 0.4
    case 'fricative':
      return 0.55
    case 'affricate':
      return voiced ? 0.08 : 0.02
    case 'approximant':
      return 1.0
    case 'lateral-approximant':
      return 0.8
    case 'lateral-fricative':
      return 0.5
    case 'trill':
      return 0.5
    case 'tap':
      return 0.02
    default:
      return 0.5
  }
}

function defaultHoldDuration(mold: ConsonantMold): number {
  switch (mold) {
    case 'plosive':
      return 0.06
    case 'nasal':
      return 0.10
    case 'fricative':
    case 'sibilant':
    case 'sibilant-fricative':
    case 'lateral-fricative':
      return 0.16
    case 'affricate':
      return 0.04
    case 'approximant':
    case 'lateral-approximant':
      return 0.04
    case 'trill':
      return 0.18
    case 'tap':
      return 0.02
    default:
      return 0.08
  }
}

function defaultReleaseDuration(mold: ConsonantMold): number {
  // Long enough for formant transitions to be audibly
  // perceptible. Real stop releases are 5-15 ms but the
  // FORMANT TRANSITION continues for 30-50 ms after the
  // release as the articulators reach the vowel target.
  // We collapse both into one "release" window here for
  // simplicity — the diameter morphs over this whole
  // window.
  switch (mold) {
    case 'plosive':
      return 0.045
    case 'nasal':
      return 0.05
    case 'fricative':
    case 'sibilant':
    case 'sibilant-fricative':
    case 'lateral-fricative':
      return 0.08
    case 'affricate':
      return 0.10
    case 'approximant':
    case 'lateral-approximant':
      return 0.10
    case 'trill':
      return 0.05
    case 'tap':
      return 0.03
    default:
      return 0.05
  }
}

function defaultVot(mold: ConsonantMold, voiced: boolean): number {
  if (voiced) return 0
  switch (mold) {
    case 'plosive':
    case 'affricate':
      return 0.06 // English-style aspirated short-lag
    default:
      return 0
  }
}

function defaultFricationAmplitude(
  mold: ConsonantMold,
  site: ConsonantSite,
): number {
  if (mold === 'sibilant' || mold === 'sibilant-fricative') {
    return site === 'alveolar' ? 0.9 : 0.75
  }
  if (mold === 'fricative' || mold === 'lateral-fricative') {
    if (site === 'glottal') return 0.25 // /h/ is quiet
    if (site === 'labiodental') return 0.45
    if (site === 'dental') return 0.5
    if (site === 'velar' || site === 'uvular') return 0.55
    if (site === 'pharyngeal') return 0.55
    return 0.55
  }
  if (mold === 'affricate') return 0.85
  return 0
}

/**
 * Build the articulation profile for a Talk consonant
 * glyph.
 *
 * Returns null if the glyph isn't a recognized consonant.
 * The caller should fall back to a generic profile in
 * that case.
 */

export function articulationFor(input: {
  talk: string
  site: ConsonantSite
  mold: ConsonantMold
  voiced: boolean
}): ConsonantArticulation {
  const { talk, site, mold, voiced } = input
  let constrictionDiameter = defaultConstrictionDiameter(mold, voiced)
  let constrictionSegment = SITE_SEGMENT[site] ?? 25
  let constrictionSpread = 2

  // Per-consonant overrides for unusual cases where the
  // generic profile doesn't capture the consonant's
  // signature feature.
  if (talk === 'r') {
    // English-style /r/ would use rw~; this is the
    // alveolar trill. Wide constriction window.
    constrictionSpread = 3
  } else if (talk === 'l') {
    // Lateral approximant — alveolar light closure with
    // a "leak" via a wider spread elsewhere. Approximate.
    constrictionDiameter = 0.4
    constrictionSpread = 2
  } else if (talk === 'L') {
    // Palatal lateral.
    constrictionDiameter = 0.5
  } else if (talk === 'y') {
    // /j/ - narrow palatal constriction.
    constrictionDiameter = 0.7
    constrictionSpread = 3
  } else if (talk === 'w') {
    // /w/ - dual constriction. Encode as the velar one;
    // lip rounding is added separately in the trajectory.
    constrictionDiameter = 0.8
    constrictionSegment = 22
    constrictionSpread = 3
  }

  return {
    talk,
    site,
    mold,
    voiced,
    constrictionSegment,
    constrictionDiameter,
    constrictionSpread,
    holdDuration: defaultHoldDuration(mold),
    releaseDuration: defaultReleaseDuration(mold),
    vot: defaultVot(mold, voiced),
    velumOpen: mold === 'nasal',
    hasFrication:
      mold === 'fricative' ||
      mold === 'sibilant' ||
      mold === 'sibilant-fricative' ||
      mold === 'lateral-fricative' ||
      mold === 'affricate',
    fricationAmplitude: defaultFricationAmplitude(mold, site),
  }
}
