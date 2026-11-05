/**
 * P011 T009 — real performance measurement for IMPLEMENTATION_PLAN §9:
 * 20,000 Chinese characters of extraction must take <= 2 s on the
 * target VM. This test builds exactly 20,000 characters from distinct
 * sentences (so deduplication cannot collapse the workload) and times
 * extractCandidates with performance.now(). The duration is logged
 * so the acceptance log shows the real number, not a claim.
 *
 * T011-01: the same discipline for conflict detection. The old
 * O(n²) detector took ~1,800 ms at 20,000 chars / 511 candidates
 * and ~39 s at 100,000 chars, freezing the UI on every
 * confirm/reject/edit. The thresholds below (500 ms / 5,000 ms)
 * are far above the fixed implementation's real time (a few ms /
 * well under a second) and far below the old behaviour, so they
 * fail on the old code and pass with margin on the new code.
 */
import { describe, expect, it } from 'vitest'
import { extractCandidates, segmentText } from '../src/lib/extract'
import { detectConflicts } from '../src/core/conflicts'
import { generateSections, sectionedCandidates } from '../src/app/workflow'

function buildChars(n: number): string {
  const sentences: string[] = []
  let i = 0
  while (sentences.join('').length < n) {
    // ~28 chars each, distinct so dedup does not collapse the input.
    sentences.push(`第${i}步目标是完成胶囊${i}，已经决定使用本地存储${i}，不要上传原文${i}。`)
    i += 1
  }
  return sentences.join('').slice(0, n)
}

function build20000Chars(): string {
  return buildChars(20000)
}

describe('T009 performance: 20,000 Chinese characters', () => {
  it('extractCandidates on exactly 20,000 chars takes < 2000 ms', () => {
    const source = build20000Chars()
    expect(source.length).toBe(20000)
    const start = performance.now()
    const items = extractCandidates(source)
    const elapsed = performance.now() - start
    // Real measurement, printed into the vitest log for the record.
    console.log(`PERF extractCandidates 20000 chars: ${elapsed.toFixed(1)} ms, ${items.length} items`)
    expect(items.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(2000)
  })

  it('segmentText on exactly 20,000 chars takes < 2000 ms', () => {
    const source = build20000Chars()
    const start = performance.now()
    const segments = segmentText(source)
    const elapsed = performance.now() - start
    console.log(`PERF segmentText 20000 chars: ${elapsed.toFixed(1)} ms, ${segments.length} segments`)
    expect(segments.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(2000)
  })
})

describe('T011-01 conflict detection scale: distinct sentences must not go quadratic', () => {
  it('detectConflicts on 20,000 chars / ~511 candidates takes < 500 ms (old code: ~1,800 ms)', () => {
    const source = build20000Chars()
    expect(source.length).toBe(20000)
    const sections = generateSections(source)
    const start = performance.now()
    const conflicts = detectConflicts(sectionedCandidates(sections))
    const elapsed = performance.now() - start
    console.log(`PERF detectConflicts 20000 chars: ${elapsed.toFixed(1)} ms, ${conflicts.length} conflicts`)
    expect(conflicts).toEqual([])
    expect(elapsed).toBeLessThan(500)
  })

  it('detectConflicts on 100,000 chars / ~2,374 candidates takes < 5,000 ms (old code: ~39,000 ms)', () => {
    const source = buildChars(100000)
    expect(source.length).toBe(100000)
    const sections = generateSections(source)
    const start = performance.now()
    const conflicts = detectConflicts(sectionedCandidates(sections))
    const elapsed = performance.now() - start
    console.log(`PERF detectConflicts 100000 chars: ${elapsed.toFixed(1)} ms, ${conflicts.length} conflicts`)
    expect(conflicts).toEqual([])
    expect(elapsed).toBeLessThan(5000)
  })
})
