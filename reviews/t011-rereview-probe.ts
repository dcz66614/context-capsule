/**
 * T011 RE-REVIEW probe — written fresh by the re-review session.
 * Does NOT reuse the repair session's tests as evidence; every check
 * below is implemented here from the spec / first review report.
 * Run: npx vite-node reviews/t011-rereview-probe.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { detectConflicts } from '../src/core/conflicts'
import type { SectionedCandidate } from '../src/core/conflicts'
import {
  generateSections,
  sectionedCandidates,
  computeConflicts,
} from '../src/app/workflow'
import {
  buildCapsuleFromSections,
  confirmItem,
  deleteItem,
} from '../src/core/capsule'
import { exportJSON, importJSON } from '../src/io/json'
import { exportMarkdown } from '../src/io/markdown'
import { SECTION_KEYS } from '../src/core/types'
import type { CapsuleItem, CapsuleSections, SectionKey } from '../src/core/types'

const ROOT = path.resolve(__dirname, '..')
let failures = 0
let passes = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passes += 1
    console.log(`PASS ${name}${detail ? ' :: ' + detail : ''}`)
  } else {
    failures += 1
    console.log(`FAIL ${name}${detail ? ' :: ' + detail : ''}`)
  }
}

// ---------------------------------------------------------------------------
// Independent brute-force reference for the three pairwise conflict rules.
// Re-implemented from the algorithm description (core normalisation +
// three rules), NOT by calling detectConflicts. Used to prove the
// group-by-core rewrite cannot miss or invent a pairwise conflict.
// ---------------------------------------------------------------------------
const NEG = [
  '不要', '禁止', '不得', '不能', '不允许', '切勿', '不再', '不使用', '不接',
  '不上传', 'never', 'do not', "don't", 'must not', 'forbidden',
]
const VERBS = [
  '已经决定', '已决定', '决定', '最终采用', '确定使用', '采用', '选择',
  '选定', '使用', '已完成', '已经完成', '尚未开始', '尚未完成', '未完成', '测试通过',
]
function refStrip(t: string) {
  return t.replace(/[。！？.!?，、；：:；\s"“”‘’'()（）]/g, '')
}
function refCore(t: string): string {
  let c = refStrip(t)
  for (const tok of NEG) c = c.split(tok.replace(/\s/g, '')).join('')
  for (const v of VERBS) c = c.split(v).join('')
  return c
}
function refNeg(t: string) {
  const c = refStrip(t)
  return NEG.some((tok) => c.includes(tok.replace(/\s/g, '')))
}
const DONE = ['已完成', '已经完成', '已实现', '已做好', 'done', 'completed']
const NOTDONE = ['尚未开始', '尚未完成', '未完成', '还没做', '没做', 'not started', 'not done']
function refPairwise(cands: readonly SectionedCandidate[]) {
  const out: Array<{ a: string; b: string; kind: string }> = []
  const seen = new Set<string>()
  const feats = cands.map((c) => ({
    core: refCore(c.item.text),
    neg: refNeg(c.item.text),
    done: DONE.some((t) => c.item.text.includes(t)),
    notDone: NOTDONE.some((t) => c.item.text.includes(t)),
  }))
  for (let i = 0; i < cands.length; i += 1) {
    for (let j = i + 1; j < cands.length; j += 1) {
      const a = cands[i]
      const b = cands[j]
      if (a.item.status === 'rejected' || b.item.status === 'rejected') continue
      if (a.item.id === b.item.id) continue
      const fa = feats[i]
      const fb = feats[j]
      if (fa.core.length === 0 || fa.core !== fb.core) continue
      let kind: string | null = null
      if (fa.neg !== fb.neg) kind = '显式否定冲突'
      else if (
        (a.section === 'decisions' && b.section === 'prohibitions') ||
        (a.section === 'prohibitions' && b.section === 'decisions')
      ) kind = '决策与禁止冲突'
      else if (
        a.section === 'progress' && b.section === 'progress' &&
        ((fa.done && fb.notDone) || (fa.notDone && fb.done))
      ) kind = '进度矛盾冲突'
      if (kind) {
        const key = `${a.item.id}|${b.item.id}|${kind}`
        if (!seen.has(key)) { seen.add(key); out.push({ a: a.item.id, b: b.item.id, kind }) }
      }
    }
  }
  return out
}

function mkItem(id: string, text: string, status: CapsuleItem['status'] = 'candidate'): CapsuleItem {
  return { id, text, origin: 'extracted', status, source: { start: 0, end: text.length } }
}
function sc(section: SectionKey, item: CapsuleItem): SectionedCandidate {
  return { section, item }
}

// ---------------------------------------------------------------------------
// A. T011-01 perf + grouping equivalence
// ---------------------------------------------------------------------------
function perfCase(nChars: number) {
  const parts: string[] = []
  let i = 0
  while (parts.join('').length < nChars) {
    parts.push(`第${i}步目标是完成胶囊${i}，已经决定使用本地存储${i}，不要上传原文${i}。`)
    i += 1
  }
  const s = parts.join('').slice(0, nChars)
  const t0 = performance.now()
  const sections = generateSections(s)
  const t1 = performance.now()
  const conf = computeConflicts(sections)
  const t2 = performance.now()
  const total = SECTION_KEYS.reduce((sum, k) => sum + sections[k].length, 0)
  console.log(
    `PERF chars=${nChars} items=${total} extract+group=${(t1 - t0).toFixed(0)}ms conflicts=${(t2 - t1).toFixed(0)}ms found=${conf.length}`,
  )
  return { total, conflictMs: t2 - t1 }
}
const p20 = perfCase(20000)
const p100 = perfCase(100000)
const p200 = perfCase(200000)
check('T011-01 20k conflicts < 500ms', p20.conflictMs < 500, `${p20.conflictMs.toFixed(0)}ms`)
check('T011-01 100k conflicts < 5000ms', p100.conflictMs < 5000, `${p100.conflictMs.toFixed(0)}ms`)
check('T011-01 200k conflicts < 5000ms', p200.conflictMs < 5000, `${p200.conflictMs.toFixed(0)}ms`)

// Equivalence: new grouped detector vs brute-force reference, on the
// 12 evaluation dialogues and on a synthetic mixed corpus.
const gold = JSON.parse(fs.readFileSync(path.join(ROOT, 'evaluation/gold.json'), 'utf8')) as {
  dialogues: Array<{ id: string; file: string; constraints: Array<{ id: string; phrase: string; section: SectionKey }> }>
}
let equivOk = true
for (const d of gold.dialogues) {
  const text = fs.readFileSync(path.join(ROOT, 'evaluation', d.file), 'utf8')
  const sections = generateSections(text)
  const cands = sectionedCandidates(sections)
  const got = detectConflicts(cands)
    // Pairwise rules only: decision-change warnings (rule 4, paired or
    // unpaired) are a separate mechanism, not part of the brute-force
    // reference below, so exclude all of them from this comparison.
    .filter((c) => !c.reason.startsWith('决策变更'))
    .map((c) => `${c.a.item.id}|${c.b.item.id}|${c.reason.split('：')[0]}`)
  const want = refPairwise(cands).map((r) => `${r.a}|${r.b}|${r.kind}`)
  const same = got.length === want.length && got.every((v, idx) => v === want[idx])
  if (!same) {
    equivOk = false
    console.log(`EQUIV MISMATCH ${d.id}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`)
  }
}
check('T011-01 grouping == brute force on 12 dialogues', equivOk)

// Synthetic mixed corpus: 240 sentences, shared cores across sections.
const corpus: SectionedCandidate[] = []
const topics = ['React', 'MySQL', 'SQLite', 'Redis', '本地存储', '云端同步', '深色主题', '浅色主题']
let ci = 0
for (const t of topics) {
  corpus.push(sc('decisions', mkItem(`c${ci++}`, `决定使用${t}`)))
  corpus.push(sc('prohibitions', mkItem(`c${ci++}`, `不要使用${t}`)))
  corpus.push(sc('decisions', mkItem(`c${ci++}`, `最终采用${t}`)))
  corpus.push(sc('facts', mkItem(`c${ci++}`, `${t}已经完成`)))
  corpus.push(sc('progress', mkItem(`c${ci++}`, `${t}已经完成`)))
  corpus.push(sc('progress', mkItem(`c${ci++}`, `${t}尚未开始`)))
  corpus.push(sc('facts', mkItem(`c${ci++}`, `${t}测试通过`)))
  corpus.push(sc('openQuestions', mkItem(`c${ci++}`, `要不要使用${t}？`)))
}
const gotC = detectConflicts(corpus)
  .filter((c) => !c.reason.startsWith('决策变更'))
  .map((c) => `${c.a.item.id}|${c.b.item.id}|${c.reason.split('：')[0]}`)
const wantC = refPairwise(corpus).map((r) => `${r.a}|${r.b}|${r.kind}`)
check(
  'T011-01 grouping == brute force on 64-item mixed corpus',
  gotC.length === wantC.length && gotC.every((v, i) => v === wantC[i]),
  `got=${gotC.length} want=${wantC.length}`,
)

// Worst case: many distinct texts sharing ONE core ("React").
// Built combinatorially from stripped verbs/negations/punctuation.
const variants = new Set<string>()
const pre = ['', '决定', '已经决定', '已决定', '最终采用', '确定使用', '选择', '选定']
const neg = ['', '不要', '禁止', '不得', '不能']
const suf = ['。', '！', '？', '']
for (const a of pre) for (const b of neg) for (const c of suf) {
  variants.add(`${a}${b}使用 React${c}`)
  variants.add(`${a}${b}使用React${c}`)
}
const wc: SectionedCandidate[] = []
let wi = 0
for (const v of variants) {
  wc.push(sc(wi % 2 === 0 ? 'decisions' : 'prohibitions', mkItem(`w${wi++}`, v)))
}
console.log(`WORSTCASE same-core candidates=${wc.length}`)
const wt0 = performance.now()
const wconf = detectConflicts(wc)
const wt1 = performance.now()
console.log(`WORSTCASE conflicts=${wconf.length} time=${(wt1 - wt0).toFixed(0)}ms`)
check('T011-01 worst-case same-core group stays fast', wt1 - wt0 < 1000, `${(wt1 - wt0).toFixed(0)}ms for ${wc.length} same-core items`)
const wGot = wconf.map((c) => `${c.a.item.id}|${c.b.item.id}|${c.reason.split('：')[0]}`)
const wWant = refPairwise(wc).map((r) => `${r.a}|${r.b}|${r.kind}`)
check(
  'T011-01 worst-case == brute force',
  wGot.length === wWant.length && wGot.every((v, i) => v === wWant[i]),
  `got=${wGot.length} want=${wWant.length}`,
)

// Input immutability
const frozen = JSON.parse(JSON.stringify(corpus))
detectConflicts(corpus)
check('detectConflicts does not mutate input', JSON.stringify(corpus) === JSON.stringify(frozen))

// ---------------------------------------------------------------------------
// B. T011-02 decision-change pairing
// ---------------------------------------------------------------------------
function changeCase(texts: string[]) {
  const cands = texts.map((t, i) => sc('decisions', mkItem(`d${i}`, t)))
  return detectConflicts(cands)
}
const mis = changeCase(['决定用 MySQL 存数据。', '决定买十四寸屏幕。', '决定改用 SQLite。'])
check(
  'T011-02 mispair case no longer names the screen',
  mis.length === 1 && mis[0].unpairedChange === true && !mis[0].reason.includes('十四寸'),
  `n=${mis.length} unpaired=${mis[0]?.unpairedChange} reason=${mis[0]?.reason.slice(0, 60)}`,
)
const d03Text = fs.readFileSync(path.join(ROOT, 'evaluation/dialogues/D03.md'), 'utf8')
const d03Conf = computeConflicts(generateSections(d03Text))
const d03Changes = d03Conf.filter((c) => c.reason.startsWith('决策变更'))
check('T011-02 D03 still flags 2 changes', d03Changes.length === 2, `n=${d03Changes.length}`)
const theme = d03Changes.find((c) => c.reason.includes('浅色'))
check(
  'T011-02 D03 theme change paired with dark theme',
  !!theme && !theme.unpairedChange && theme.reason.includes('深色'),
  theme?.reason.slice(0, 80) ?? 'none',
)
const sql = d03Changes.find((c) => c.reason.includes('SQLite'))
check(
  'T011-02 D03 SQLite change is unpaired (honest)',
  !!sql && sql.unpairedChange === true && !sql.reason.includes('MySQL'),
  sql?.reason.slice(0, 80) ?? 'none',
)
// Positive control: shared topic tokens DO pair.
const pos = changeCase(['决定用 MySQL 存用户数据。', '决定改用 MySQL 集群。'])
check(
  'T011-02 shared-topic change pairs correctly',
  pos.length === 1 && !pos[0].unpairedChange && pos[0].reason.includes('MySQL'),
  pos[0]?.reason.slice(0, 80) ?? 'none',
)

// ---------------------------------------------------------------------------
// C. T011-03 exportJSON confirmed-only
// ---------------------------------------------------------------------------
const cap = {
  schemaVersion: '1.0.0' as const,
  title: 'probe',
  sections: (() => {
    const s = Object.fromEntries(SECTION_KEYS.map((k) => [k, [] as CapsuleItem[]])) as CapsuleSections
    s.goal = [
      mkItem('g1', '已确认目标', 'confirmed'),
      mkItem('g2', '候选目标', 'candidate'),
      mkItem('g3', '已拒绝目标', 'rejected'),
    ]
    return s
  })(),
}
const outJson = exportJSON(cap as never)
const parsed = JSON.parse(outJson) as { sections: Record<string, Array<{ id: string }>> }
check(
  'T011-03 exportJSON leaks no candidate/rejected',
  parsed.sections.goal.length === 1 && parsed.sections.goal[0].id === 'g1',
  `goal items=${JSON.stringify(parsed.sections.goal.map((i) => i.id))}`,
)
const outMd = exportMarkdown(cap as never)
check(
  'T011-03 exportMarkdown also confirmed-only (control)',
  outMd.includes('已确认目标') && !outMd.includes('候选目标') && !outMd.includes('已拒绝目标'),
)

// ---------------------------------------------------------------------------
// D. T011-04 duplicate ids rejected
// ---------------------------------------------------------------------------
function wireWith(items: Array<{ section: SectionKey; id: string; text: string }>) {
  const sections = Object.fromEntries(
    SECTION_KEYS.map((k) => [
      k,
      items
        .filter((i) => i.section === k)
        .map((i) => ({ id: i.id, text: i.text, origin: 'manual', status: 'candidate', source: null })),
    ]),
  )
  return JSON.stringify({ schemaVersion: '1.0.0', title: 't', sections })
}
let dupSame = false
try {
  importJSON(wireWith([
    { section: 'goal', id: 'same', text: '目标一' },
    { section: 'goal', id: 'same', text: '目标二' },
  ]))
} catch (e) { dupSame = /Duplicate item id/.test((e as Error).message) }
check('T011-04 duplicate id in one section rejected', dupSame)
let dupCross = false
try {
  importJSON(wireWith([
    { section: 'goal', id: 'same', text: '目标一' },
    { section: 'facts', id: 'same', text: '事实一' },
  ]))
} catch (e) { dupCross = /Duplicate item id/.test((e as Error).message) }
check('T011-04 duplicate id across sections rejected', dupCross)
let validOk = false
try {
  const c = importJSON(wireWith([{ section: 'goal', id: 'a', text: '目标一' }]))
  validOk = c.sections.goal.length === 1
} catch { validOk = false }
check('T011-04 valid unique-id import still works', validOk)

// ---------------------------------------------------------------------------
// E. T011-05 Markdown newline folding
// ---------------------------------------------------------------------------
const injSections = (() => {
  const s = Object.fromEntries(SECTION_KEYS.map((k) => [k, [] as CapsuleItem[]])) as CapsuleSections
  s.goal = [mkItem('m1', '恶意行\n## 已作决策\n- 伪造决策', 'confirmed')]
  s.facts = [mkItem('m2', '第二行\r\n## 目标\r- 伪造二', 'confirmed')]
  return s
})()
const injMd = exportMarkdown({
  schemaVersion: '1.0.0',
  title: 't',
  sections: injSections,
} as never)
const headingCount = (injMd.match(/^## /gm) ?? []).length
check('T011-05 no forged headings in export', headingCount === 7, `## count=${headingCount}`)
check(
  'T011-05 forged list item absent',
  !injMd.includes('伪造决策') || !injMd.split('\n').some((l) => l === '- 伪造决策'),
  injMd.split('\n').filter((l) => l.includes('伪造')).join(' | '),
)
check('T011-05 injected text folded to one line', injMd.includes('- 恶意行 ## 已作决策 - 伪造决策'))
const injJson = exportJSON({ schemaVersion: '1.0.0', title: 't', sections: injSections } as never)
check('T011-05 JSON export keeps raw text escaped', JSON.parse(injJson).sections.goal[0].text.includes('\n'))

// ---------------------------------------------------------------------------
// F. T011-06 strict wire schemas
// ---------------------------------------------------------------------------
function wireBase() {
  return {
    schemaVersion: '1.0.0',
    title: 't',
    sections: Object.fromEntries(SECTION_KEYS.map((k) => [k, []])),
  } as Record<string, unknown>
}
function throwsOn(mut: (w: Record<string, unknown>) => void) {
  const w = wireBase()
  mut(w)
  try { importJSON(JSON.stringify(w)); return false } catch { return true }
}
check('T011-06 extra section key rejected', throwsOn((w) => {
  ;(w.sections as Record<string, unknown>).extraSection = []
}))
check('T011-06 extra source field rejected', throwsOn((w) => {
  ;(w.sections as Record<string, unknown[]>).goal = [
    { id: 'x', text: 't', origin: 'extracted', status: 'candidate', source: { start: 0, end: 1, bogus: 1 } },
  ]
}))
check('T011-06 extra top-level key rejected (control)', throwsOn((w) => { w.extra = 1 }))
check('T011-06 extra item field rejected (control)', throwsOn((w) => {
  ;(w.sections as Record<string, unknown[]>).goal = [
    { id: 'x', text: 't', origin: 'manual', status: 'candidate', source: null, bogus: 1 },
  ]
}))
check('T011-06 bad version rejected (control)', throwsOn((w) => { w.schemaVersion = '2.0.0' }))
// Pre-existing, reviewer-noted: source end beyond any text is accepted
// (no source text exists at import time to check against).
const outOfRange = (() => {
  const w = wireBase()
  ;(w.sections as Record<string, unknown[]>).goal = [
    { id: 'x', text: 't', origin: 'extracted', status: 'candidate', source: { start: 0, end: 999999 } },
  ]
  try { importJSON(JSON.stringify(w)); return true } catch { return false }
})()
console.log(`NOTE source end=999999 accepted on import: ${outOfRange} (pre-existing, not one of the six findings)`)

// ---------------------------------------------------------------------------
// G. Invariants re-check
// ---------------------------------------------------------------------------
// Seven-section contract in both exports, always, even empty.
const emptyCap = buildCapsuleFromSections(
  Object.fromEntries(SECTION_KEYS.map((k) => [k, []])) as CapsuleSections,
  'empty',
)
check(
  'Invariant seven sections in JSON export',
  Object.keys(JSON.parse(exportJSON(emptyCap)).sections).length === 7,
)
check(
  'Invariant seven sections in Markdown export',
  (exportMarkdown(emptyCap).match(/^## /gm) ?? []).length === 7,
)
check('Invariant empty sections show 未提供', exportMarkdown(emptyCap).includes('- 未提供'))
// Confirm cannot be bypassed: candidate/rejected never enter buildCapsule.
const mixed = generateSections('目标是完成原型。已经决定使用 React。不要上传原文。')
const built = buildCapsuleFromSections(mixed, 't')
const builtTotal = SECTION_KEYS.reduce((s, k) => s + built.sections[k].length, 0)
check('Invariant buildCapsule confirmed-only (0 confirmed in)', builtTotal === 0, `total=${builtTotal}`)
const confirmed = confirmItem(mixed, 'decisions', mixed.decisions[0].id)
const built2 = buildCapsuleFromSections(confirmed, 't')
check(
  'Invariant confirmed item enters build, others do not',
  built2.sections.decisions.length === 1 && built2.sections.decisions[0].text === mixed.decisions[0].text,
)
// Deleted item stays deleted.
const afterDelete = deleteItem(confirmed, 'decisions', mixed.decisions[0].id)
const built3 = buildCapsuleFromSections(afterDelete, 't')
check('Invariant deleted item does not resurrect', built3.sections.decisions.length === 0)
// Source offsets slice == text for all extracted items in all 12 dialogues.
let sliceOk = true
let sliceN = 0
for (const d of gold.dialogues) {
  const text = fs.readFileSync(path.join(ROOT, 'evaluation', d.file), 'utf8')
  const sections = generateSections(text)
  for (const k of SECTION_KEYS) {
    for (const item of sections[k]) {
      if (item.origin === 'extracted' && item.source) {
        sliceN += 1
        if (text.slice(item.source.start, item.source.end) !== item.text) sliceOk = false
      }
    }
  }
}
check('Invariant source offsets slice==text (12 dialogues)', sliceOk, `checked=${sliceN}`)

// Independent 71/71 re-check with my own oracle code (not the runner).
let correct = 0
let anySection = 0
for (const d of gold.dialogues) {
  const text = fs.readFileSync(path.join(ROOT, 'evaluation', d.file), 'utf8')
  const sections = generateSections(text)
  // Oracle: confirm any item containing a gold phrase.
  const confirmedSections = JSON.parse(JSON.stringify(sections)) as CapsuleSections
  for (const k of SECTION_KEYS) {
    for (const item of confirmedSections[k]) {
      const hit = d.constraints.some((c) => item.text.includes(c.phrase))
      if (hit) item.status = 'confirmed'
    }
  }
  const cap2 = buildCapsuleFromSections(confirmedSections, d.id)
  for (const c of d.constraints) {
    const inRight = cap2.sections[c.section].some((i) => i.text.includes(c.phrase))
    const inAny = SECTION_KEYS.some((k) => cap2.sections[k].some((i) => i.text.includes(c.phrase)))
    if (inRight) correct += 1
    if (inAny) anySection += 1
  }
}
check('T010 retention re-verified independently', correct === 71 && anySection === 71, `correct=${correct}/71 any=${anySection}/71`)

// Control summaries: spot-check D01 (5/7 claimed by first reviewer).
const control = fs.readFileSync(path.join(ROOT, 'evaluation/control-summaries.md'), 'utf8')
const d01 = gold.dialogues[0]
const d01Block = control.split('## D01')[1]?.split('## D02')[0] ?? ''
let d01Hit = 0
for (const c of d01.constraints) {
  // semantic spot check: phrase core words present
  const core = c.phrase.replace(/目标是|决定|不要|下一步/g, '')
  if (d01Block.includes(core.slice(0, 4))) d01Hit += 1
}
console.log(`NOTE control D01 spot-check (crude substring): ${d01Hit}/7 — first reviewer claimed 5/7 by semantic adjudication; not independently re-adjudicated here`)

console.log(`\nTOTAL pass=${passes} fail=${failures}`)
if (failures > 0) process.exitCode = 1
