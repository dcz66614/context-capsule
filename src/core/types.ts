/**
 * P011 Context Capsule — T004/T005 spec-layout module.
 * Spec module layout (PROJECT_BOOK §7.1) is src/core/..., while the
 * S0/T001–T003 scaffold built src/lib/... . This file is the spec
 * location for T002 types: it re-exports the lib implementation so
 * both paths resolve to the same types, and the mapping is recorded
 * in README.md. No behaviour is duplicated here.
 */
export * from '../lib/types'
