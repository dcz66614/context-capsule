/**
 * P011 T010 — automated product evaluation runner.
 *
 * Uses the REAL engine code (src/lib/extract, src/app/workflow,
 * src/core/capsule, src/io/json, src/io/markdown) — nothing is
 * re-implemented here. Gold standards were frozen in gold.json
 * BEFORE this runner first ran; the runner never edits them.
 *
 * "Oracle confirmation" simulation, labelled honestly: a candidate is
 * confirmed iff its text contains a frozen gold phrase. That is a
 * perfect-knowledge stand-in for the human review step, used ONLY to
 * measure the rule engine's extraction quality (part (a) of the
 * report). Real human confirmation quality (part (b)) and
 * task-continuation quality (part (c)) are NOT measured here and
 * are reported as NOT MEASURED / PENDING.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractCandidates, segmentText } from '../src/lib/extract'
import { generateSections, sensitiveHints, sectionedCandidates } from '../src/app/workflow'
import { detectConflicts } from '../src/core/conflicts'
import { buildCapsuleFromSections } from '../src/core/capsule'
import { exportJSON, importJSON } from '../src/io/json'
import { exportMarkdown } from '../src/io/markdown'
import { SECTION_KEYS, type SectionKey } from '../src/core/types'
import { SECTION_LABELS } from '../src/components/labels'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'logs')
mkdirSync(OUT, { recursive: true })

interface GoldConstraint {
  id: string
  section: SectionKey
  phrase: string
}
interface GoldDialogue {
  id: string
  file: string
  coverage: string
  constraints: GoldConstraint[]
  supersededNotGold?: string[]
  sensitiveNotGold?: string[]
}
interface GoldFile {
  version: string
  frozenAt: string
  dialogues: GoldDialogue[]
}

const gold: GoldFile = JSON.parse(readFileSync(join(HERE, 'gold.json'), 'utf-8'))

function readDialogue(id: string): string {
  return readFileSync(join(HERE, 'dialogues', `${id}.md`), 'utf-8').trimEnd()
}

function readControlSummaries(): Record<string, string> {
  const text = readFileSync(join(HERE, 'control-summaries.md'), 'utf-8')
  const out: Record<string, string> = {}
  const parts = text.split(/^## (D\d+)\s*$/m)
  for (let i = 1; i < parts.length; i += 2) {
    out[parts[i]] = (parts[i + 1] ?? '').trim()
  }
  return out
}
const controls = readControlSummaries()

// Manual semantic adjudication of the control summaries (see
// control-adjudication.json). Substring matching is invalid for
// paraphrased summaries: run 1 scored the control at 3/71 by
// substring, which is a measurement error, not the real retention.
// The adjudication file records a per-constraint YES/NO by meaning.
let adjudication: Record<string, string[]> = {}
try {
  const adj = JSON.parse(readFileSync(join(HERE, 'control-adjudication.json'), 'utf-8')) as {
    dialogues: Record<string, { retained: string[] }>
  }
  for (const [id, v] of Object.entries(adj.dialogues)) adjudication[id] = v.retained
} catch {
  adjudication = {}
}

interface DialogueResult {
  id: string
  coverage: string
  chars: number
  candidates: number
  candidatesBySection: Record<string, number>
  confirmed: number
  rejected: number
  goldTotal: number
  goldRetainedCorrectSection: number
  goldRetainedAnySection: number
  goldMissed: string[]
  goldWrongSection: { id: string; expected: string; foundIn: string[] }[]
  falsePositives: { section: string; text: string }[]
  decisionFalsePositives: { section: string; text: string }[]
  supersededExtracted: string[]
  sensitiveInCandidates: string[]
  sensitiveInExport: string[]
  sensitiveHints: { kind: string; snippet: string }[]
  jsonRoundTripOk: boolean
  jsonRoundTripDetail: string
  markdownSevenSections: boolean
  markdownHeadingsFound: string[]
  unconfirmedInMarkdown: string[]
  unconfirmedInJson: number
  exportedItems: number
  controlRetained: number
  controlMissed: string[]
  controlSubstringRetained: number
  controlSubstringMissed: string[]
  conflicts: { id: string; reason: string }[]
  duplicatePhraseCandidates: { phrase: string; count: number; texts: string[] }[]
}

const results: DialogueResult[] = []

for (const d of gold.dialogues) {
  const text = readDialogue(d.id)
  const sections = generateSections(text)
  const allCandidates = SECTION_KEYS.flatMap((k) =>
    sections[k].map((item) => ({ section: k, item })),
  )

  // Oracle confirmation: confirm iff the candidate text contains a gold phrase.
  const confirmedSections = JSON.parse(JSON.stringify(sections)) as typeof sections
  for (const k of SECTION_KEYS) {
    for (const item of confirmedSections[k]) {
      item.status = d.constraints.some((c) => item.text.includes(c.phrase))
        ? 'confirmed'
        : 'rejected'
    }
  }
  const confirmed = SECTION_KEYS.flatMap((k) =>
    confirmedSections[k].filter((i) => i.status === 'confirmed'),
  )
  const capsule = buildCapsuleFromSections(confirmedSections, `T010 ${d.id}`)
  const md = exportMarkdown(capsule)
  const json = exportJSON(capsule)

  // JSON round-trip: semantic equality (title + all sections, item fields).
  let roundTripOk = true
  let roundTripDetail = 'ok'
  try {
    const back = importJSON(json)
    if (back.title !== capsule.title) throw new Error('title mismatch')
    for (const k of SECTION_KEYS) {
      const a = capsule.sections[k]
      const b = back.sections[k]
      if (a.length !== b.length) throw new Error(`section ${k} length ${a.length} != ${b.length}`)
      for (let i = 0; i < a.length; i++) {
        const x = a[i]
        const y = b[i]
        const sameSource =
          (x.source === undefined && y.source === undefined) ||
          (x.source !== undefined &&
            y.source !== undefined &&
            x.source.start === y.source.start &&
            x.source.end === y.source.end)
        if (x.id !== y.id || x.text !== y.text || x.origin !== y.origin || x.status !== y.status || !sameSource) {
          throw new Error(`section ${k} item ${i} differs`)
        }
      }
    }
  } catch (e) {
    roundTripOk = false
    roundTripDetail = e instanceof Error ? e.message : String(e)
  }

  // Markdown: seven sections present (by label heading).
  const headingsFound = SECTION_KEYS.filter((k) => md.includes(`## ${SECTION_LABELS[k]}`))
  // Unconfirmed leakage: exact "- <text>" lines in Markdown must all be confirmed items.
  const confirmedTexts = new Set(confirmed.map((i) => i.text))
  const mdLines = new Set(md.split('\n').filter((l) => l.startsWith('- ') && l !== '- 未提供'))
  const unconfirmedInMd: string[] = []
  for (const { item } of allCandidates) {
    if (item.status === 'candidate' || true) {
      // item.status in `sections` is always 'candidate'; check the oracle decision instead.
    }
  }
  const rejectedTexts = SECTION_KEYS.flatMap((k) =>
    confirmedSections[k].filter((i) => i.status === 'rejected').map((i) => i.text),
  )
  for (const t of rejectedTexts) {
    if (mdLines.has(`- ${t}`) && !confirmedTexts.has(t)) unconfirmedInMd.push(t)
  }
  const parsedJson = JSON.parse(json) as {
    sections: Record<string, { status: string }[]>
  }
  const unconfirmedInJson = SECTION_KEYS.reduce(
    (n, k) => n + parsedJson.sections[k].filter((i) => i.status !== 'confirmed').length,
    0,
  )

  // Gold retention, measured on the EXPORTED capsule.
  const exported = SECTION_KEYS.flatMap((k) =>
    capsule.sections[k].map((item) => ({ section: k, item })),
  )
  let correct = 0
  let anywhere = 0
  const missed: string[] = []
  const wrongSection: DialogueResult['goldWrongSection'] = []
  for (const c of d.constraints) {
    const hits = exported.filter((e) => e.item.text.includes(c.phrase))
    if (hits.length === 0) {
      missed.push(c.id)
    } else {
      anywhere++
      if (hits.some((h) => h.section === c.section)) correct++
      else wrongSection.push({ id: c.id, expected: c.section, foundIn: hits.map((h) => h.section) })
    }
  }

  // False positives: candidates containing no gold phrase at all.
  const fps = allCandidates
    .filter(({ item }) => !d.constraints.some((c) => item.text.includes(c.phrase)))
    .map(({ section, item }) => ({ section, text: item.text }))
  const decisionFps = fps.filter((f) => f.section === 'decisions')

  // Superseded decisions (D03): old decisions must NOT be confirmed.
  const supersededExtracted = (d.supersededNotGold ?? []).filter((s) =>
    allCandidates.some(({ item }) => item.text.includes(s)),
  )

  // Sensitive sentences (D06): in candidates, never in export.
  const sensitiveInCandidates = (d.sensitiveNotGold ?? []).filter((s) =>
    allCandidates.some(({ item }) => item.text.includes(s)),
  )
  const sensitiveInExport = (d.sensitiveNotGold ?? []).filter((s) =>
    exported.some((e) => e.item.text.includes(s)) || md.includes(s),
  )

  // Duplicate-phrase candidates: >1 candidate containing the same gold phrase.
  const dupPhrases: DialogueResult['duplicatePhraseCandidates'] = []
  for (const c of d.constraints) {
    const hits = allCandidates.filter(({ item }) => item.text.includes(c.phrase))
    if (hits.length > 1) {
      dupPhrases.push({ phrase: c.phrase, count: hits.length, texts: hits.map((h) => h.item.text) })
    }
  }

  // Control summary retention (substring check on gold phrases).
  // NOTE: kept only as a diagnostic — it undercounts paraphrase.
  // The reported control number comes from manual adjudication below.
  const control = controls[d.id] ?? ''
  const controlMissedSubstring = d.constraints.filter((c) => !control.includes(c.phrase)).map((c) => c.id)
  const adjudicatedRetained = adjudication[d.id] ?? []
  const controlMissed = d.constraints
    .filter((c) => !adjudicatedRetained.includes(c.id))
    .map((c) => c.id)

  // Explicit conflicts flagged by the T004 detector on the raw candidates.
  const conflicts = detectConflicts(sectionedCandidates(sections))

  results.push({
    id: d.id,
    coverage: d.coverage,
    chars: text.length,
    candidates: allCandidates.length,
    candidatesBySection: Object.fromEntries(
      SECTION_KEYS.map((k) => [k, sections[k].length]),
    ),
    confirmed: confirmed.length,
    rejected: allCandidates.length - confirmed.length,
    goldTotal: d.constraints.length,
    goldRetainedCorrectSection: correct,
    goldRetainedAnySection: anywhere,
    goldMissed: missed,
    goldWrongSection: wrongSection,
    falsePositives: fps,
    decisionFalsePositives: decisionFps,
    supersededExtracted,
    sensitiveInCandidates,
    sensitiveInExport,
    sensitiveHints: sensitiveHints(text).map((h) => ({ kind: h.kind, snippet: h.snippet })),
    jsonRoundTripOk: roundTripOk,
    jsonRoundTripDetail: roundTripDetail,
    markdownSevenSections: headingsFound.length === 7,
    markdownHeadingsFound: headingsFound,
    unconfirmedInMarkdown: unconfirmedInMd,
    unconfirmedInJson,
    exportedItems: exported.length,
    controlRetained: d.constraints.length - controlMissed.length,
    controlMissed,
    controlSubstringRetained: d.constraints.length - controlMissedSubstring.length,
    controlSubstringMissed: controlMissedSubstring,
    conflicts: conflicts.map((c) => ({ id: c.id, reason: c.reason })),
    duplicatePhraseCandidates: dupPhrases,
  })
}

// ---- Performance: exactly 20,000 Chinese chars ----
const perfBase = readDialogue('D10')
let perfInput = ''
while (perfInput.length < 20000) perfInput += perfBase + '\n'
perfInput = perfInput.slice(0, 20000)
if (perfInput.length !== 20000) throw new Error(`perf input length ${perfInput.length}`)
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const extractTimes: number[] = []
const segmentTimes: number[] = []
for (let i = 0; i < 5; i++) {
  let t0 = performance.now()
  extractCandidates(perfInput)
  extractTimes.push(performance.now() - t0)
  t0 = performance.now()
  segmentText(perfInput)
  segmentTimes.push(performance.now() - t0)
}
const perfItems = extractCandidates(perfInput).length

// ---- Totals ----
const totals = {
  dialogues: results.length,
  goldTotal: results.reduce((n, r) => n + r.goldTotal, 0),
  goldRetainedCorrectSection: results.reduce((n, r) => n + r.goldRetainedCorrectSection, 0),
  goldRetainedAnySection: results.reduce((n, r) => n + r.goldRetainedAnySection, 0),
  candidates: results.reduce((n, r) => n + r.candidates, 0),
  falsePositives: results.reduce((n, r) => n + r.falsePositives.length, 0),
  decisionFalsePositives: results.reduce((n, r) => n + r.decisionFalsePositives.length, 0),
  jsonRoundTripOk: results.filter((r) => r.jsonRoundTripOk).length,
  markdownSevenSections: results.filter((r) => r.markdownSevenSections).length,
  unconfirmedInExports: results.reduce((n, r) => n + r.unconfirmedInMarkdown.length + r.unconfirmedInJson, 0),
  controlRetained: results.reduce((n, r) => n + r.controlRetained, 0),
  perf: {
    chars: 20000,
    extractMsMedian: median(extractTimes),
    extractMsMin: Math.min(...extractTimes),
    extractMsMax: Math.max(...extractTimes),
    segmentMsMedian: median(segmentTimes),
    itemsExtracted: perfItems,
    runs: 5,
  },
}

const output = { generatedAt: new Date().toISOString(), goldFrozenAt: gold.frozenAt, totals, results }
writeFileSync(join(HERE, 'results.json'), JSON.stringify(output, null, 2) + '\n', 'utf-8')

const pct = (a: number, b: number) => (b === 0 ? 'n/a' : `${((100 * a) / b).toFixed(1)}%`)
console.log('=== P011 T010 automated evaluation ===')
console.log(`dialogues: ${totals.dialogues}, gold constraints: ${totals.goldTotal}`)
console.log(`retention correct-section: ${totals.goldRetainedCorrectSection}/${totals.goldTotal} = ${pct(totals.goldRetainedCorrectSection, totals.goldTotal)}`)
console.log(`retention any-section:     ${totals.goldRetainedAnySection}/${totals.goldTotal} = ${pct(totals.goldRetainedAnySection, totals.goldTotal)}`)
console.log(`control summary retention (manual adjudication): ${totals.controlRetained}/${totals.goldTotal} = ${pct(totals.controlRetained, totals.goldTotal)} (substring diagnostic would say ${results.reduce((n, r) => n + r.controlSubstringRetained, 0)}/${totals.goldTotal} — invalid for paraphrase, see report)`)
console.log(`candidates: ${totals.candidates}, false positives (non-gold): ${totals.falsePositives}, of which decisions: ${totals.decisionFalsePositives}`)
console.log(`JSON round-trip ok: ${totals.jsonRoundTripOk}/${totals.dialogues}; 7-section Markdown: ${totals.markdownSevenSections}/${totals.dialogues}; unconfirmed items in exports: ${totals.unconfirmedInExports}`)
console.log(`perf 20000 chars: extract median ${totals.perf.extractMsMedian.toFixed(1)} ms (min ${totals.perf.extractMsMin.toFixed(1)}, max ${totals.perf.extractMsMax.toFixed(1)}), segment median ${totals.perf.segmentMsMedian.toFixed(1)} ms, ${totals.perf.itemsExtracted} items`)
for (const r of results) {
  console.log(
    `${r.id} [${r.coverage}] gold ${r.goldRetainedCorrectSection}/${r.goldTotal} correct-section, ` +
      `${r.goldRetainedAnySection}/${r.goldTotal} any-section, control ${r.controlRetained}/${r.goldTotal}, ` +
      `cand ${r.candidates} (FP ${r.falsePositives.length}, decFP ${r.decisionFalsePositives.length}), ` +
      `missed [${r.goldMissed.join(',') || '-'}], wrong-section [${r.goldWrongSection.map((w) => w.id).join(',') || '-'}], ` +
      `roundtrip ${r.jsonRoundTripOk ? 'ok' : 'FAIL:' + r.jsonRoundTripDetail}, md7 ${r.markdownSevenSections}`,
  )
  if (r.conflicts.length) console.log(`  ${r.id} conflicts flagged: ${r.conflicts.length} — ${r.conflicts.map((c) => c.reason).join(' || ')}`)
  if (r.supersededExtracted.length) console.log(`  ${r.id} superseded decisions extracted as candidates: ${r.supersededExtracted.join(' | ')}`)
  if (r.sensitiveInCandidates.length) console.log(`  ${r.id} sensitive in candidates: ${r.sensitiveInCandidates.join(' | ')}; in export: ${r.sensitiveInExport.join(' | ') || 'none'}; hints: ${JSON.stringify(r.sensitiveHints)}`)
  if (r.duplicatePhraseCandidates.length) console.log(`  ${r.id} duplicate-phrase candidates: ${JSON.stringify(r.duplicatePhraseCandidates.map((x) => `${x.phrase} x${x.count}`))}`)
  for (const f of r.falsePositives) console.log(`  ${r.id} FP [${f.section}] ${f.text}`)
}
console.log('results written to evaluation/results.json')
