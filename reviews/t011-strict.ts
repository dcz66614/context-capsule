import { importJSON } from '/home/hatch/workspace/p011-context-capsule/src/io/json'
const base = {
  schemaVersion: '1.0.0', title: 't',
  sections: { goal: [], facts: [], decisions: [], openQuestions: [], prohibitions: [], progress: [], nextSteps: [] },
}
function tryImport(name: string, obj: unknown) {
  try { importJSON(JSON.stringify(obj)); console.log(`${name}: ACCEPTED (no throw)`) }
  catch (e) { console.log(`${name}: REJECTED (${e instanceof Error ? e.message.split('\n')[0] : e})`) }
}
// extra top-level key (strict -> should reject)
tryImport('extra top-level key', { ...base, unexpected: 1 })
// extra section key (wireSectionsSchema not strict -> ?)
tryImport('extra section key', { ...base, sections: { ...base.sections, extraSection: [] } })
// extra key inside source
const withSource = JSON.parse(JSON.stringify(base))
withSource.sections.goal = [{ id: 'g1', text: 'x', origin: 'manual', status: 'confirmed', source: { start: 0, end: 1, bogus: 9 } }]
tryImport('extra key inside source', withSource)
// extra key inside item (strict -> should reject)
const withItem = JSON.parse(JSON.stringify(base))
withItem.sections.goal = [{ id: 'g1', text: 'x', origin: 'manual', status: 'confirmed', source: null, bogus: 1 }]
tryImport('extra key inside item', withItem)
// source end beyond any plausible text (no source text to check against)
const farSource = JSON.parse(JSON.stringify(base))
farSource.sections.goal = [{ id: 'g1', text: 'x', origin: 'extracted', status: 'confirmed', source: { start: 0, end: 999999 } }]
tryImport('source end=999999', farSource)
// missing title
const noTitle = JSON.parse(JSON.stringify(base)); delete noTitle.title
tryImport('missing title', noTitle)
// title too long
tryImport('title 501 chars', { ...base, title: 't'.repeat(501) })
// item with empty text
const emptyText = JSON.parse(JSON.stringify(base))
emptyText.sections.goal = [{ id: 'g1', text: '', origin: 'manual', status: 'confirmed', source: null }]
tryImport('empty item text', emptyText)
