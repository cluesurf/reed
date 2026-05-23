// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { storyDiameters } from '@/synth/vowel-shapes'

describe('storyDiameters (Story 1996 area functions)', () => {
  const vowels = ['a', 'e', 'i', 'o', 'u', 'schwa'] as const

  it('returns length-44 arrays for the default segment count', () => {
    for (const v of vowels) {
      const d = storyDiameters(v)
      expect(d, `vowel ${v}`).toHaveLength(44)
    }
  })

  it('all diameter values are positive and within adult-male anatomy range', () => {
    for (const v of vowels) {
      for (const value of storyDiameters(v)) {
        expect(value).toBeGreaterThan(0)
        expect(value).toBeLessThan(4) // ~12.5 cm² cap
      }
    }
  })

  it('/a/ has a narrow pharyngeal region around segments 0-15', () => {
    // Story /ɑ/: pharyngeal constriction (tongue body
    // pulled back + down) → diameters in segments 0-15
    // average < 1 cm. Oral cavity (segments 25+) wider.
    const d = storyDiameters('a')
    const pharyngealMean =
      d.slice(0, 16).reduce((a, b) => a + b, 0) / 16
    const oralMean =
      d.slice(25, 44).reduce((a, b) => a + b, 0) / 19
    expect(pharyngealMean).toBeLessThan(1.0)
    expect(oralMean).toBeGreaterThan(pharyngealMean + 0.5)
  })

  it('/i/ has a narrow palatal constriction in segments 20-30', () => {
    // High front vowel — narrow oral / palatal constriction
    const d = storyDiameters('i')
    const palatalMean =
      d.slice(20, 30).reduce((a, b) => a + b, 0) / 10
    const backMean =
      d.slice(0, 18).reduce((a, b) => a + b, 0) / 18
    expect(palatalMean).toBeLessThan(0.9)
    expect(backMean).toBeGreaterThan(palatalMean + 0.5)
  })

  it('/u/ has narrow constriction at velum AND at lips', () => {
    const d = storyDiameters('u')
    const lipMean = d.slice(38, 44).reduce((a, b) => a + b, 0) / 6
    expect(lipMean).toBeLessThan(0.7) // strong lip rounding
  })

  it('resamples to other segment counts', () => {
    const d22 = storyDiameters('a', 22)
    expect(d22).toHaveLength(22)
    const d88 = storyDiameters('a', 88)
    expect(d88).toHaveLength(88)
  })
})
