# P011 Context Capsule — 对话续接胶囊

Status: construction in progress, NOT a release. Formally established
2026-11-04 in ChatGPT project `agent project automatic`, decision GO,
direction locked, SPEC 1.0.0. This run covers S0/T001–T008.

## What it is (from the establishment summary)

One-click structured handover package for independent developers /
product managers continuing a long AI session in a new session or
another model. The user confirms items, then exports Markdown/JSON
usable in other models. Local Web tool, rule-based template + human
check, no external API. Local-first data, no default persistence of
raw dialogue, memory-only workspace.

Fixed seven sections, in deterministic order:
`goal / facts / decisions / openQuestions / prohibitions / progress / nextSteps`.

Item fields: `id / text / origin (extracted|manual) / status
(candidate|confirmed|rejected) / source offsets in UTF-16 code units`
(JavaScript string indices are UTF-16 code units).

Interface contracts (later tasks): `extractCandidates / detectConflicts /
buildCapsule / exportMarkdown / exportJSON / importJSON`.
Invariants: extract does not modify source, conflicts never
auto-delete, buildCapsule only accepts confirmed items, JSON import
validates version/structure, deterministic export order.

## Done in this run

- S0/T001: Vite + React + TypeScript scaffold, Vitest config,
  Playwright config, `.gitignore`.
- T002: `src/lib/types.ts` (seven-section capsule, item fields),
  `src/lib/schema.ts` (Zod validation, version `1.0.0` enforced).
- T003: `src/lib/extract.ts` — pure-TS `segmentText` (paragraph +
  sentence split, offsets tracked by scanning) and `extractCandidates`
  (rule-based, one suggested section per segment, priority:
  prohibitions → openQuestions → decisions → progress → nextSteps →
  goal → facts fallback, deduplicated, **candidate-only, never
  auto-confirmed**).

## Spec check against verbatim texts (2026-11-04, after re-retrieval)

Full verbatim texts are now in this workspace as
`PROJECT_BOOK.md` (16,090 bytes, SHA-256
a81dbd5cc1bea36778762329cc78843be40bd04c24774daf7c7f3c88044d46e1)
and `IMPLEMENTATION_PLAN.md` (11,316 bytes, SHA-256
985a17c3e5f9ab40899c924b77051388666cf0498a13d98394b136ad55f4582b),
also uploaded to Drive P011-context-capsule 01_project_book /
02_implementation_plan and registered SPEC_FROZEN (NOT ACCEPTED) in
FACTORY_INDEX.md (Drive file 1qHHIqtkjZMd96A7mcTOCmDhUhcxSZO_n).
DOCX versions remain outstanding, not fabricated.

Layout difference found, and how it was handled without breaking
passing tests (T002/T003 were built from the establishment summary
only, before the verbatim texts arrived):
- Spec (PROJECT_BOOK §7.1) wants `src/core/segment.ts`,
  `extract.ts`, `conflicts.ts`, `capsule.ts`, `schema.ts` and
  `src/io/markdown.ts`, `json.ts`, `src/components/`, `src/app/`.
- Scaffold actually has `src/lib/types.ts`, `schema.ts`,
  `extract.ts` (segment merged into extract.ts; no core/io split,
  no components/app yet).
- Resolution: new T004/T005 code lives in the spec locations
  `src/core/conflicts.ts` and `src/core/capsule.ts`; spec locations
  `src/core/types.ts`, `segment.ts`, `extract.ts`, `schema.ts`
  re-export the lib implementations, so both paths resolve to the
  same code. `src/io/`, `src/components/`, `src/app/` are still
  outstanding (T006–T008). Do not claim the spec layout is fully
  migrated until those exist.
- Contract note (not silently rewritten): spec §8 shows a capsule
  with `schemaVersion` and manual items with `source: null`, while
  the scaffold's Zod schema uses `version: '1.0.0'` and optional
  `source` (absent for manual items). T007 JSON import/export must
  translate `schemaVersion` ↔ `version` and `null` ↔ absent
  explicitly, or the scaffold schema must be changed with its tests
  updated at that time. This run did not change the schema.
- Spec §4.2 todo line is verbatim “待办：、待完成、需要处理。”
  (no first signal word invented); plan §3 does contain a
  dependency graph (T001 → T002 → parallel T003–T005 and T006–T008
  → T009–T010 → T011–T012), not only a sentence.

## T004/T005 done in this run

- T004: `src/core/conflicts.ts` — `detectConflicts` returns
  explicit conflicts only, never deletes or resolves, input never
  mutated; each conflict reason quotes BOTH conflicting candidates
  (FR06). Rules: same-core opposite negation, decision vs
  prohibition on the same core, progress done vs not-done on the
  same core. Rejected items are excluded. Implicit semantics are
  not claimed.
- T005: `src/core/capsule.ts` — `confirmItem`, `rejectItem`,
  `editItem` (keeps source as review clue), `addManualItem`
  (origin manual, no source, starts candidate), `deleteItem`,
  `clearCapsule`, `buildCapsule` and `buildCapsuleFromSections`
  (confirmed-only, fixed section order, input order within a
  section, pure, no input mutation).
- Tests: `tests/conflicts.test.ts` (5 tests, incl. CC-05),
  `tests/capsule.test.ts` (6 tests, incl. CC-07, CC-08, CC-11,
  CC-12).

## Verified in this run (real runs, not claims)

- `npm run typecheck` — exit 0
- `npm test` (Vitest) — 3 files, 22 tests, 22 passed, 0 failed
  (extract 11 + conflicts 5 + capsule 6)
- `npm run build` — exit 0, 29 modules transformed
- Playwright E2E (`npm run test:e2e`) — config present, NOT run in
  this run, not claimed as passed.

## T006–T008 done in this run

- T006: `src/components/` — `labels.ts` (fixed section/status
  labels), `CandidateCard.tsx` (content/source/status/edit
  actions, React-escaped rendering), `SectionCard.tsx` (grouped
  card + manual add), `ConflictWarnings.tsx` (each warning quotes
  BOTH conflicting candidates), `PreviewPane.tsx` (preview +
  copy/download), `Workbench.tsx` (three-column desktop grid,
  vertical steps on narrow screens, raw-text char count,
  generate/clear buttons, in-page clear confirmation, empty-state
  guidance). Tests: `tests/components.test.tsx` (3 tests, incl.
  CC-10 HTML escaping).
- T007: `src/io/markdown.ts` (confirmed-only export, all seven
  sections always present, empty section renders “未提供” per
  PROJECT_BOOK §8 — note §9's example uses “暂无” for the same
  case; §8's rule is followed), `src/io/json.ts` (spec wire
  format: `schemaVersion`, manual `source: null`, strict
  validation, documented implementation limits — item text
  ≤5000 chars, title ≤500 chars, total items ≤1000, JSON
  ≤1,000,000 chars — failing loudly, never silently repaired).
  This resolves the earlier schema-translation gap: the
  translation lives only in `src/io/json.ts`, internal code
  keeps `version` + absent source. Tests: `tests/io.test.ts`
  (5 tests, incl. CC-08, CC-09, CC-11).
- T008: `src/app/workflow.ts` (pure helpers: generate, conflicts,
  source snippets, stats, preview, handover prompt, local
  email/phone risk hints) and `src/app/App.tsx` (full flow:
  paste → generate → edit/confirm/reject → preview → export →
  JSON-file import → clear with confirmation; memory-only state,
  no fetch/localStorage/analytics; download via Blob, copy via
  clipboard with fallback). `src/main.tsx` now renders this App.
  Tests: `tests/workflow.test.ts` (6 tests). FR coverage in this
  run: FR01–FR11 and FR13–FR14 have code paths + tests; FR12
  offline is by design (no network calls in app/workflow code,
  workflow still works with fetch stubbed to throw) but a
  browser offline check with a network log belongs to T009
  and is NOT claimed here.
- Layout note: spec layout is now complete at module level —
  `src/core/`, `src/io/`, `src/components/`, `src/app/` all
  exist; `src/lib/` remains as the shared implementation behind
  `src/core/` re-exports (T002/T003), recorded, not hidden.

## Verified in this run (real runs, not claims)

- `npm run typecheck` — exit 0
- `npm test` (Vitest) — 8 files, 60 tests, 60 passed, 0 failed
  (T011 repair added 11 regression tests; see release/TEST_LOG.txt)
- `npm run build` — exit 0
- Playwright E2E (`npm run test:e2e`) — 3/3 passed in a real browser
  (flow / offline / xss; see release/E2E_LOG.txt)

## Pending — do NOT treat as done

- T009 independent tests, T010 product evaluation (automated part),
  T011 independent review (first FAIL, repaired, re-review PASS),
  T012 release engineering — all done; see release/ for evidence.
  T010 human-participant parts (b) confirmed-handover quality and
  (c) continuation quality / organising time remain NOT MEASURED —
  no participants, nothing fabricated.
- DOCX versions of PROJECT_BOOK / IMPLEMENTATION_PLAN are in
  release/ (faithful conversions, same text and structure).
- Validation targets are goals, not results: 12 Chinese synthetic
  dialogues, key-constraint retention ≥95% (automated re-run 71/71
  = 100%), confirmed-decision error ≤5% (NOT MEASURED — oracle
  confirmation cannot judge it), JSON round-trip 100%, seven-section
  completeness 100%, unconfirmed-export 0, median organisation time
  −≥25% vs plain summary (NOT MEASURED — needs participants);
  20,000 Chinese characters extraction ≤2s on target VM (measured
  ~2 ms).
- No final review in ChatGPT, no GitHub upload in this run.
  Spec Drive upload (PROJECT_BOOK / IMPLEMENTATION_PLAN only) is
  done separately and recorded above; it is not a release upload.

## Commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e   # later tasks; not verified in this run
```

## Constraints honoured in this run

Cloud VM workspace only, no local PC touched, no GitHub upload, no
external messages/orders/submissions in Sam's name, no medical or
financial advice features, sensitive info handling (view/edit/delete)
is a later-task requirement, not yet implemented.
