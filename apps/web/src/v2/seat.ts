import type { UserProfile } from '@recruitflow/contracts';

/**
 * Seats (Roadmap v2 §3): every production role collapses into one of three.
 * Interviewer and licence-check are permissions, not seats.
 */
export type Seat = 'employee' | 'manager' | 'admin';
export const SEATS: readonly Seat[] = ['employee', 'manager', 'admin'];
export const SEAT_LABEL: Record<Seat, string> = { employee: 'Employee', manager: 'Manager', admin: 'Admin' };

export function isSeat(value: unknown): value is Seat {
  return typeof value === 'string' && (SEATS as readonly string[]).includes(value.toLowerCase());
}

/**
 * PROVISIONAL role-code → seat map. Roadmap §3/§11: the full table waits for
 * the admin role export (backend step 0a); only ROLE_001 Recruiter-offshore →
 * Employee is confirmed. Everything else here is a best guess from the seed
 * role codes. B10 #22 sends `me.seat`, which always wins; this table is only the dev fallback
 * for an API without B10.
 */
export const PROVISIONAL_ROLE_SEATS: Readonly<Record<string, Seat>> = {
  // Admin
  ADMINISTRATOR: 'admin',
  SYSADMINISTRATOR: 'admin',
  // Manager (owns requisitions / direct reports / offer decision)
  HIRING_MANAGER: 'manager',
  HR_MANAGER: 'manager',
  TALENT_MANAGER: 'manager',
  TEAM_LEADER: 'manager',
  TEAM_LEAD: 'manager',
  RECRUITMENT_LEAD: 'manager',
  LEAD_RECRUITER: 'manager',
  OFFER_APPROVER: 'manager',
  // Employee
  ROLE_001: 'employee', // Recruiter-offshore (confirmed, Roadmap §3)
  RECRUITER: 'employee',
  EMPLOYEE: 'employee',
  VIEWER: 'employee',
  HR_OPERATIONS: 'employee',
  // Permissions-not-seats: on their own these fall to Employee.
  INTERVIEWER: 'employee',
  LICENSE_SPECIALIST: 'employee',
  // PR33-3: /auth/me seats final approvers as Employee; the label must agree (home: the final approval inbox).
  FINAL_HIRING_APPROVER: 'employee',
};

/** Permission fallback for role codes not in the map (custom roles). */
const ADMIN_PERMISSIONS = ['USERS_MANAGE', 'ROLES_MANAGE'];
const MANAGER_PERMISSIONS = ['VACANCY_REQUEST_APPROVE', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL'];

const RANK: Record<Seat, number> = { employee: 0, manager: 1, admin: 2 };

type MeLike = Pick<UserProfile, 'roles' | 'permissions'> & { seat?: unknown };

/**
 * The ONE place the frontend decides a seat.
 * `me.seat` from /auth/me (B10) is used as-is; the provisional table is the fallback.
 */
export function resolveSeat(me: MeLike | null | undefined): Seat {
  if (!me) return 'employee';
  if (isSeat(me.seat)) return me.seat.toLowerCase() as Seat;

  const roles = Array.isArray(me.roles) ? me.roles : [];
  const permissions = new Set(Array.isArray(me.permissions) ? me.permissions : []);
  let seat: Seat = 'employee';
  let hasUnknownRole = roles.length === 0;
  for (const role of roles) {
    const mapped = PROVISIONAL_ROLE_SEATS[String(role?.code ?? '').trim().toUpperCase()];
    if (!mapped) { hasUnknownRole = true; continue; }
    // A person holds one seat; if several roles map, the broadest wins (provisional).
    if (RANK[mapped] > RANK[seat]) seat = mapped;
  }
  if (hasUnknownRole) {
    if (ADMIN_PERMISSIONS.some((p) => permissions.has(p)) && RANK.admin > RANK[seat]) seat = 'admin';
    else if (MANAGER_PERMISSIONS.some((p) => permissions.has(p)) && RANK.manager > RANK[seat]) seat = 'manager';
  }
  return seat;
}
