type NotificationRef = { kind: string; ref_type: string | null; ref_id: number | null };
type ExistingNotification = NotificationRef & { is_resolved: boolean };

/** 같은 kind+ref_type+ref_id로 이미 미해결 알림이 있으면 새로 만들지 않는다. */
export function shouldCreateNotification(
  existing: ExistingNotification[],
  candidate: NotificationRef,
): boolean {
  return !existing.some(
    (e) =>
      !e.is_resolved &&
      e.kind === candidate.kind &&
      e.ref_type === candidate.ref_type &&
      e.ref_id === candidate.ref_id,
  );
}
