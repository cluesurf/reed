// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Kelly-Lochbaum digital waveguide vocal tract — TS port
 * of the core algorithm in Pink Trombone's `Tract.js`.
 *
 * The tract is modeled as a chain of N concatenated
 * cylindrical tube segments with varying cross-sectional
 * area. Wave propagation is decomposed into right-going
 * and left-going traveling waves; at each segment
 * boundary, the reflection coefficient is computed from
 * the area discontinuity.
 *
 * Per-sample inner loop:
 *
 *   for each junction i:
 *     offset = k[i] * (right[i-1] + left[i])
 *     right_junction[i] = right[i-1] - offset
 *     left_junction[i]  = left[i]    + offset
 *   propagate right_junction → right, left_junction → left
 *   read output from right[N-1] (lip end)
 *
 * Glottal pulses enter at the glottal end. Lip radiation
 * is the standard `-0.85` open-end reflection.
 *
 * v0 keeps the simpler model: constant 0.999 per-segment
 * loss, rigid walls, no piriform sinuses, no subglottal
 * coupling. The richer model from `synth.md`'s upgrade
 * table lands in subsequent phases.
 */

export type TractConfig = {
  /** Number of segments. Defaults to 44 (Pink Trombone's choice). */
  length?: number
  /** Reflection coefficient at the glottal end. Defaults to 0.75. */
  glottisReflection?: number
  /** Reflection coefficient at the lip end. Defaults to -0.85. */
  lipReflection?: number
  /** Per-segment loss factor per sample. Defaults to 0.999. */
  segmentLoss?: number
  /**
   * Per-segment 1-pole low-pass loss filter coefficient.
   * y[n] = (1 - α) · x[n] + α · y[n-1].
   * α ≈ 0.012 gives realistic F3-F5 bandwidth widening
   * without flattening F1. See note/library/reed/topics/
   * frequency-dependent-tract-loss.md.
   */
  lossAlpha?: number
}

export class Tract {
  readonly length: number
  private readonly glottisReflection: number
  private readonly lipReflection: number
  private readonly segmentLoss: number
  private readonly lossAlpha: number

  // Traveling wave state.
  readonly right: Float64Array
  readonly left: Float64Array
  private readonly rightJunction: Float64Array
  private readonly leftJunction: Float64Array

  // Per-segment per-direction 1-pole loss filter state.
  private readonly rightLoss: Float64Array
  private readonly leftLoss: Float64Array

  // Per-junction reflection coefficient + per-segment area.
  readonly diameter: Float64Array
  readonly area: Float64Array
  readonly reflection: Float64Array

  constructor(config: TractConfig = {}) {
    this.length = config.length ?? 44
    this.glottisReflection = config.glottisReflection ?? 0.75
    this.lipReflection = config.lipReflection ?? -0.85
    this.segmentLoss = config.segmentLoss ?? 0.999
    this.lossAlpha = config.lossAlpha ?? 0.012

    const N = this.length
    this.right = new Float64Array(N)
    this.left = new Float64Array(N)
    this.rightJunction = new Float64Array(N + 1)
    this.leftJunction = new Float64Array(N + 1)
    this.rightLoss = new Float64Array(N)
    this.leftLoss = new Float64Array(N)
    this.diameter = new Float64Array(N)
    this.area = new Float64Array(N)
    this.reflection = new Float64Array(N + 1)

    // Default to a neutral schwa-like profile so the
    // first thing the user hears, even without setting
    // diameters, is something vowel-like.
    this.setSchwa()
    this.refreshReflection()
  }

  /**
   * Set every segment's diameter from a flat array.
   * Length must match `this.length`; extras are ignored,
   * missing entries are clamped to 1.5 cm.
   */
  setDiameters(diameters: ArrayLike<number>): void {
    for (let i = 0; i < this.length; i += 1) {
      const d = i < diameters.length ? diameters[i]! : 1.5
      this.diameter[i] = Math.max(0, d)
    }
    this.refreshReflection()
  }

  /**
   * Default neutral rest profile (gross schwa shape).
   * Pink Trombone uses a three-step diameter profile:
   * 0.6 cm at the glottal end, 1.1 cm in the lower
   * pharynx, 1.5 cm through the oral cavity.
   */
  setSchwa(): void {
    const N = this.length
    for (let i = 0; i < N; i += 1) {
      let d: number
      if (i < (7 / 44) * N - 0.5) d = 0.6
      else if (i < (12 / 44) * N) d = 1.1
      else d = 1.5
      this.diameter[i] = d
    }
  }

  /**
   * One step of the propagation loop.
   *
   * `glottalInput` is the source sample arriving at the
   * glottal junction. `noiseInput` and `noiseSegment` are
   * an optional intra-tract noise source: a frication
   * generator that injects turbulence at a specific
   * segment inside the tract (Pink Trombone's mechanism).
   * Pass 0 / -1 to skip noise injection.
   *
   * Returns the audio sample at the lip end.
   */
  step(
    glottalInput: number,
    noiseInput = 0,
    noiseSegment = -1,
  ): number {
    const N = this.length

    // Glottal end: reflection coefficient + injected
    // source.
    this.rightJunction[0] = this.left[0]! * this.glottisReflection + glottalInput
    // Lip end: open-end reflection.
    this.leftJunction[N] = this.right[N - 1]! * this.lipReflection

    // Per-junction scattering. Pink Trombone's exact form.
    for (let i = 1; i < N; i += 1) {
      const k = this.reflection[i]!
      const off = k * (this.right[i - 1]! + this.left[i]!)
      this.rightJunction[i] = this.right[i - 1]! - off
      this.leftJunction[i] = this.left[i]! + off
    }

    // Intra-tract noise injection at the constriction.
    // Splits equally between right-going and left-going
    // waves at the junction.
    if (noiseSegment >= 0 && noiseSegment <= N && noiseInput !== 0) {
      this.rightJunction[noiseSegment]! += noiseInput * 0.5
      this.leftJunction[noiseSegment]! += noiseInput * 0.5
    }

    // Propagate + apply per-segment loss. Two stages:
    //   1. Constant loss: y = x · segmentLoss (≈0.999).
    //   2. Frequency-dependent 1-pole LP per segment per
    //      direction. Adds extra damping at high
    //      frequencies, leaving F1 nearly untouched while
    //      F3-F5 widen toward realistic bandwidths.
    const a = this.lossAlpha
    const oneMinusA = 1 - a
    for (let i = 0; i < N; i += 1) {
      const rIn = this.rightJunction[i]! * this.segmentLoss
      this.rightLoss[i] = oneMinusA * rIn + a * this.rightLoss[i]!
      this.right[i] = this.rightLoss[i]!
      const lIn = this.leftJunction[i + 1]! * this.segmentLoss
      this.leftLoss[i] = oneMinusA * lIn + a * this.leftLoss[i]!
      this.left[i] = this.leftLoss[i]!
    }

    return this.right[N - 1]!
  }

  /**
   * Set every segment diameter at once and refresh the
   * derived reflection coefficients. Cheap to call per
   * sample for time-varying articulation.
   */
  setDiametersAndRefresh(diameters: ArrayLike<number>): void {
    for (let i = 0; i < this.length; i += 1) {
      this.diameter[i] = Math.max(0, diameters[i] ?? 1.5)
    }
    this.refreshReflection()
  }

  reset(): void {
    this.right.fill(0)
    this.left.fill(0)
    this.rightJunction.fill(0)
    this.leftJunction.fill(0)
    this.rightLoss.fill(0)
    this.leftLoss.fill(0)
  }

  refreshReflection(): void {
    const N = this.length
    for (let i = 0; i < N; i += 1) {
      this.area[i] = this.diameter[i]! * this.diameter[i]!
    }
    this.reflection[0] = 0
    for (let i = 1; i < N; i += 1) {
      const aPrev = this.area[i - 1]!
      const aCur = this.area[i]!
      const sum = aPrev + aCur
      this.reflection[i] = sum === 0 ? 0.999 : (aPrev - aCur) / sum
    }
    this.reflection[N] = 0
  }
}
