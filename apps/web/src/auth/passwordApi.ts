import type { ChangePasswordInput } from '@recruitflow/contracts';
import { postApi } from '../api/client';

/** Self-service password change: POST /me/password (existing endpoint, also used by Profile). */
export function changeOwnPassword(input: ChangePasswordInput): Promise<{ message: string }> {
  return postApi<{ message: string }>('/me/password', input);
}
