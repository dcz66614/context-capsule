/**
 * P011 Context Capsule — T004/T005 spec-layout module.
 * Spec location for schema (PROJECT_BOOK §7.1: src/core/schema.ts).
 * Re-exports the T002 Zod schemas in src/lib/schema.ts; see
 * README.md for the layout mapping and the version-field note
 * (lib uses `version`, spec §8 shows `schemaVersion`).
 */
export * from '../lib/schema'
