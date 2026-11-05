/**
 * P011 Context Capsule — T006 conflict warnings.
 * Spec PROJECT_BOOK §6 / FR06: a warning must name BOTH conflicting
 * candidates; a vague red warning alone is not allowed. Conflicts
 * are advisory only — nothing is auto-deleted or auto-resolved.
 */
import type { Conflict } from '../core/conflicts'

export function ConflictWarnings(props: { conflicts: Conflict[] }) {
  if (props.conflicts.length === 0) {
    return <p>未发现显式冲突。</p>
  }
  return (
    <div role="alert" aria-label="冲突提示">
      <h3>冲突提示（{props.conflicts.length} 条，请人工检查）</h3>
      <ul>
        {props.conflicts.map((conflict) => (
          <li key={conflict.id}>{conflict.reason}</li>
        ))}
      </ul>
      <p>冲突不会自动删除或裁决任何一条候选。</p>
    </div>
  )
}
