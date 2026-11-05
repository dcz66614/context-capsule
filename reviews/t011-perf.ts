import { extractCandidates, segmentText } from '/home/hatch/workspace/p011-context-capsule/src/lib/extract'
import { detectConflicts } from '/home/hatch/workspace/p011-context-capsule/src/core/conflicts'
import { generateSections, sectionedCandidates } from '/home/hatch/workspace/p011-context-capsule/src/app/workflow'
function build(n: number): string {
  const parts: string[] = []
  let i = 0
  while (parts.join('').length < n) { parts.push(`第${i}步目标是完成胶囊${i}，已经决定使用本地存储${i}，不要上传原文${i}。`); i++ }
  return parts.join('').slice(0, n)
}
for (const n of [20000, 100000, 200000]) {
  const s = build(n)
  let t0 = performance.now()
  const items = extractCandidates(s)
  const t1 = performance.now()
  const sections = generateSections(s)
  const t2 = performance.now()
  const conf = detectConflicts(sectionedCandidates(sections))
  const t3 = performance.now()
  console.log(`chars=${n} items=${items.length} extract=${(t1-t0).toFixed(0)}ms generate=${(t2-t1).toFixed(0)}ms conflicts=${(t3-t2).toFixed(0)}ms conflictsFound=${conf.length}`)
}
