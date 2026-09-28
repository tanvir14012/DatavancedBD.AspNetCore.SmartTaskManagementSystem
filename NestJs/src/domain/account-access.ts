const applicationRoles = new Set(['Admin', 'Project Manager', 'Team Member']);

/** A catalog member also needs an active tenant account and an application role. */
export function mayUseTenantAccount(
  lockoutEnd: Date | null,
  roles: readonly string[],
  now: Date,
): boolean {
  return (
    (lockoutEnd === null || lockoutEnd <= now) &&
    roles.some((role) => applicationRoles.has(role))
  );
}
