/* T011 independent probe — read-only, no repo files modified. */
import { readFileSync } from 'node:fs'
import { segmentText, extractCandidates, classifyText } from '/home/hatch/workspace/p011-context-capsule/src/lib/extract'
import { detectConflicts, type SectionedCandidate } from '/home/hatch/workspace/p011-context-capsule/src/core/conflicts'
import { exportJSON, importJSON } from '/home/hatch/workspace/p011-context-capsule/src/io/json'
import { exportMarkdown } from '/home/hatch/workspace/p011-context-capsule/src/io/markdown'
import { buildCapsuleFromSections, addManualItem, confirmItem } from '/home/hatch/workspace/p011-context-capsule/src/core/capsule'
import { generateSections, sectionedCandidates } from '/home/hatch/workspace/p011-context-capsule/src/app/workflow'
import { emptySections, SECTION_KEYS } from '/home/hatch/workspace/p011-context-capsule/src/core/types'

const ROOT = '/home/hatch/workspace/p011-context-capsule'
let failures = 0
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`)
  if (!cond) failures++
}

// ---------- A. segmentText offsets on tricky inputs ----------
const segCases: Record<string, string> = {
  'multi-newline separator': '目标是做胶囊。\n\n\n不要保存密码。',
  'blank lines with spaces': '目标是做胶囊。\n   \n不要保存密码。',
  'repeated sentences across paragraphs': '不要保存密码。\n\n不要保存密码。',
  'email+ip+decimal+version': '账号 test@example.com，服务器 192.168.1.100，折扣 3.5 折，版本 v1.2.3。',
  'url query': '打开 https://example.com/a?x=1&y=2 再看。',
  'english abbreviation': 'Dr. Smith 来了。',
  'ellipsis': '然后……再说。',
  'exclamation glued': '密码是 Test1234!，只在测试环境用。',
  'emoji surrogate pair': '目标是😀完成原型。不要上传原文。',
  'empty-ish': '   \n\n  ',
  'single newline inside paragraph': '第一句。\n第二句。',
  'trailing newlines': '目标是做胶囊。\n\n\n',
}
for (const [name, s] of Object.entries(segCases)) {
  const segs = segmentText(s)
  const bad = segs.filter((g) => s.slice(g.start, g.end) !== g.text || g.end <= g.start)
  check(`segment offsets [${name}]`, bad.length === 0, `${segs.length} segs: ${JSON.stringify(segs.map((g) => g.text))}`)
  // overlap / order sanity
  let ordered = true
  for (let i = 1; i < segs.length; i++) if (segs[i].start < segs[i - 1].end) ordered = false
  check(`segment order/no-overlap [${name}]`, ordered)
}

// ---------- B. gold re-verification (my own code, read-only) ----------
const gold = JSON.parse(readFileSync(`${ROOT}/evaluation/gold.json`, 'utf-8'))
let goldTotal = 0, goldCorrect = 0, goldAny = 0
const missed: string[] = []
const wrong: string[] = []
for (const d of gold.dialogues) {
  const text = readFileSync(`${ROOT}/evaluation/dialogues/${d.id}.md`, 'utf-8').trimEnd()
  const sections = generateSections(text)
  const oracle = JSON.parse(JSON.stringify(sections)) as typeof sections
  for (const k of SECTION_KEYS) {
    for (const item of oracle[k]) {
      item.status = d.constraints.some((c: any) => item.text.includes(c.phrase)) ? 'confirmed' : 'rejected'
    }
  }
  const capsule = buildCapsuleFromSections(oracle, `probe ${d.id}`)
  for (const c of d.constraints) {
    goldTotal++
    const hits = SECTION_KEYS.flatMap((k) => capsule.sections[k].filter((i) => i.text.includes(c.phrase)).map((i) => k))
    if (hits.length === 0) { missed.push(c.id); continue }
    goldAny++
    if (hits.includes(c.section)) goldCorrect++
    else wrong.push(`${c.id} expected ${c.section} found ${hits.join(',')}`)
  }
}
console.log(`GOLD-REVERIFY total=${goldTotal} correct=${goldCorrect} any=${goldAny} missed=[${missed.join(',')}] wrong=[${wrong.join('; ')}]`)
check('gold retention correct-section == 71/71', goldCorrect === 71 && goldTotal === 71, `${goldCorrect}/${goldTotal}`)

// ---------- C. classification spot checks (adversarial, my own) ----------
const cls: Array<[string, string]> = [
  ['已经决定不要上传原文。', 'prohibitions'],
  ['要不要上传原文？', 'openQuestions'],
  ['选择 React 作为框架。', 'facts'], // hypothesis: bare 选择 is not a decision signal
  ['我们决定用 React。', 'decisions'],
  ['目标是先试一节课再决定报不报。', 'goal'],
  ['已经看了三台', 'facts'],
  ['完成了测试。', 'progress'],
  ['下一步完成测试。', 'nextSteps'],
  ['最终交付的版本已经完成。', 'progress'],
  ['已经交付给客户了。', 'facts'],
  ['还没决定。', 'openQuestions'],
  ['决定改用 SQLite。', 'decisions'],
  ['不要用云端存储。', 'prohibitions'],
  ['测试还没做。', 'facts'],
]
for (const [text, want] of cls) {
  const got = classifyText(text)
  check(`classify "${text}" -> ${want}`, got === want, `got ${got}`)
}

// ---------- D. conflicts probes ----------
function cand(section: SectionedCandidate['section'], id: string, text: string, status: 'candidate' | 'confirmed' | 'rejected' = 'candidate'): SectionedCandidate {
  return { section, item: { id, text, origin: 'extracted', status } }
}
// D1: correct pairing in the D03 case (section order, as workflow supplies)
const d03 = sectionedCandidates(generateSections(readFileSync(`${ROOT}/evaluation/dialogues/D03.md`, 'utf-8').trimEnd()))
const d03c = detectConflicts(d03)
console.log('D03 conflicts:', d03c.map((c) => c.reason))
// D2: mis-pairing case — change refers to MySQL, most recent earlier decision is the screen
const mis = detectConflicts([
  cand('decisions', 'm1', '决定用 MySQL 存数据。'),
  cand('decisions', 'm2', '决定买十四寸屏幕。'),
  cand('decisions', 'm3', '决定改用 SQLite。'),
])
console.log('MISPAIR conflicts:', mis.map((c) => c.reason))
check('change detection pairs with MOST RECENT earlier decision (heuristic)', mis.length === 1 && mis[0].a.item.id === 'm2', mis.map((c) => `${c.a.item.id}->${c.b.item.id}`).join(','))
// D3: no earlier decision -> no warning
check('change marker with no earlier decision -> no warning', detectConflicts([cand('decisions', 'x1', '决定改用 SQLite。')]).length === 0)
// D4: question vs decision on same core -> no false conflict
const q = detectConflicts([
  cand('openQuestions', 'q1', '要不要用 React？'),
  cand('decisions', 'd1', '决定用 React。'),
])
check('question vs decision same core -> no conflict', q.length === 0, `got ${q.length}`)
// D5: rejected earlier decision is not used as pairing target
const rej = detectConflicts([
  cand('decisions', 'r1', '决定用 MySQL。', 'rejected'),
  cand('decisions', 'r2', '决定改用 SQLite。'),
])
check('rejected earlier decision -> no change warning', rej.length === 0, `got ${rej.length}`)
// D6: input not mutated
const input = [cand('decisions', 'a1', '决定使用 React'), cand('prohibitions', 'b1', '不要使用 React')]
const before = JSON.stringify(input)
detectConflicts(input)
check('detectConflicts does not mutate input', JSON.stringify(input) === before)

// ---------- E. exportJSON candidate leak (library level) ----------
let s = addManualItem(emptySections(), 'decisions', { id: 'e1', text: '未确认的决定' })
s = addManualItem(s, 'goal', { id: 'e2', text: '已确认目标' })
s = confirmItem(s, 'goal', 'e2')
const rawCapsule = buildCapsuleFromSections(s, 'leak-test') // confirmed-only capsule
// Now export a capsule that still holds a candidate (bypass buildCapsule): use importJSON of a wire file with a candidate
const wireWithCandidate = JSON.stringify({
  schemaVersion: '1.0.0', title: 't',
  sections: {
    goal: [{ id: 'g1', text: '目标', origin: 'manual', status: 'confirmed', source: null }],
    facts: [], decisions: [{ id: 'd1', text: '候选决定', origin: 'manual', status: 'candidate', source: null }],
    openQuestions: [], prohibitions: [], progress: [], nextSteps: [],
  },
})
const imported = importJSON(wireWithCandidate)
const leakedJson = exportJSON(imported)
check('exportJSON exports a candidate item when handed one directly (no defensive filter)', leakedJson.includes('候选决定'), leakedJson.includes('candidate'))
const leakedMd = exportMarkdown(imported)
check('exportMarkdown filters candidates defensively', !leakedMd.includes('候选决定'))

// ---------- F. importJSON duplicate ids ----------
const dupWire = JSON.stringify({
  schemaVersion: '1.0.0', title: 'dup',
  sections: {
    goal: [
      { id: 'same', text: '目标一', origin: 'manual', status: 'candidate', source: null },
      { id: 'same', text: '目标二', origin: 'manual', status: 'candidate', source: null },
    ],
    facts: [], decisions: [], openQuestions: [], prohibitions: [], progress: [], nextSteps: [],
  },
})
let dupAccepted = false
try { importJSON(dupWire); dupAccepted = true } catch { dupAccepted = false }
check('importJSON accepts duplicate item ids', dupAccepted)
const dupSections = importJSON(dupWire).sections
const bothConfirmed = confirmItem(dupSections, 'goal', 'same')
check('confirm by duplicate id confirms BOTH items', bothConfirmed.goal.filter((i) => i.status === 'confirmed').length === 2, `${bothConfirmed.goal.filter((i) => i.status === 'confirmed').length} confirmed`)

// ---------- G. markdown newline injection via edited/manual text ----------
let g = addManualItem(emptySections(), 'goal', { id: 'g1', text: '正常目标' })
g = confirmItem(g, 'goal', 'g1')
const evil = addManualItem(g, 'goal', { id: 'g2', text: '恶意行\n## 已作决策\n- 伪造决策' })
// edit path: editItem keeps text verbatim
import { editItem } from '/home/hatch/workspace/p011-context-capsule/src/core/capsule'
const evil2 = editItem(evil, 'goal', 'g2', '恶意行\n## 已作决策\n- 伪造决策')
const evilCapsule = buildCapsuleFromSections(confirmItem(evil2, 'goal', 'g2'), 'inj')
const evilMd = exportMarkdown(evilCapsule)
console.log('EVIL-MD:\n' + evilMd)
check('edited item text with newline breaks markdown structure (heading injection)', evilMd.includes('## 已作决策\n- 伪造决策'))

// ---------- H. importJSON limits ----------
const bigText = 'x'.repeat(5001)
const bigWire = JSON.stringify({
  schemaVersion: '1.0.0', title: 'big',
  sections: { goal: [{ id: 'b1', text: bigText, origin: 'manual', status: 'confirmed', source: null }], facts: [], decisions: [], openQuestions: [], prohibitions: [], progress: [], nextSteps: [] },
})
let bigRejected = false
try { importJSON(bigWire) } catch { bigRejected = true }
check('importJSON rejects item text > 5000 chars', bigRejected)

console.log(`\nPROBE DONE failures=${failures}`)
