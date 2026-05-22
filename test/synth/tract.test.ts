// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { Tract } from '@/synth/tract'

describe('Tract', () => {
  it('allocates buffers of the configured length', () => {
    const t = new Tract({ length: 44 })
    expect(t.right).toHaveLength(44)
    expect(t.left).toHaveLength(44)
    expect(t.diameter).toHaveLength(44)
  })

  it('initializes with a non-zero schwa profile', () => {
    const t = new Tract({ length: 44 })
    let sum = 0
    for (let i = 0; i < 44; i += 1) sum += t.diameter[i]!
    expect(sum).toBeGreaterThan(0)
  })

  it('accepts a custom diameter array', () => {
    const t = new Tract({ length: 8 })
    t.setDiameters([1, 1, 1, 1, 1, 1, 1, 1])
    for (let i = 0; i < 8; i += 1) {
      expect(t.diameter[i]).toBe(1)
    }
  })

  it('produces finite output for a steady impulse train input', () => {
    const t = new Tract({ length: 44 })
    for (let n = 0; n < 1024; n += 1) {
      const input = n % 200 === 0 ? 0.5 : 0
      const out = t.step(input)
      expect(Number.isFinite(out)).toBe(true)
    }
  })

  it('responds (non-zero output) to a non-zero input', () => {
    const t = new Tract({ length: 44 })
    let maxAbs = 0
    for (let n = 0; n < 1024; n += 1) {
      const input = Math.sin((n / 48_000) * 2 * Math.PI * 100)
      const out = t.step(input)
      maxAbs = Math.max(maxAbs, Math.abs(out))
    }
    expect(maxAbs).toBeGreaterThan(0)
  })

  it('reset zeroes the state buffers', () => {
    const t = new Tract({ length: 44 })
    for (let n = 0; n < 100; n += 1) t.step(0.5)
    t.reset()
    let sum = 0
    for (let i = 0; i < 44; i += 1) sum += Math.abs(t.right[i]!) + Math.abs(t.left[i]!)
    expect(sum).toBe(0)
  })
})
