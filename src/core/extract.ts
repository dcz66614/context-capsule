/**
 * P011 Context Capsule — T004/T005 spec-layout module.
 * Spec location for extract (PROJECT_BOOK §7.1: src/core/extract.ts).
 * Re-exports the T003 implementation in src/lib/extract.ts, including
 * the classifyText helper added for T004/T005.
 */
export {
  segmentText,
  extractCandidates,
  groupCandidatesBySection,
  classifyText,
} from '../lib/extract'
export type { TextSegment } from '../lib/extract'
