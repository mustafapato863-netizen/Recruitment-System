export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = /reject|declin|cancel|fail|blocked|withdraw/.test(normalized)
    ? 'danger'
    : /approv|active|open|joined|complete|success|verified|accepted/.test(normalized)
      ? 'success'
      : /pending|await|review|hold|draft|overdue|warning/.test(normalized)
        ? 'warning'
        : /interview|screen|offer|sent|new|progress/.test(normalized)
          ? 'info'
          : 'neutral';

  return <span className={`ui-status-badge ui-status-badge--${tone}`}><span aria-hidden="true" />{status}</span>;
}
