import { isUUID } from 'class-validator';

/**
 * Same rule as Nest's default ParseUUIDPipe (class-validator `isUUID` with no
 * version). Guards must use this before they read the database, because pipes
 * run only after guards.
 */
export function isUuid(value: string): boolean {
  return isUUID(value);
}
