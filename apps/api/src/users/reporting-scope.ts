/** Active users who report to `managerId`, directly or through someone who does. The manager is not included. */
export function reportIds(
  users: Array<{ id: string; managerId: string | null }>,
  managerId: string,
): Set<string> {
  const allowed = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const user of users) {
      if (user.id === managerId || allowed.has(user.id)) continue;
      const reportsHere = user.managerId === managerId || (user.managerId !== null && allowed.has(user.managerId));
      if (reportsHere) {
        allowed.add(user.id);
        grew = true;
      }
    }
  }
  return allowed;
}
