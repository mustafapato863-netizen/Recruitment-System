export function StatusBadge({ status }: { status: string }) {
  const statusClass = `status-chip status-${status.toLowerCase().replaceAll(' ', '-')}`;
  return <em className={statusClass}>{status}</em>;
}
