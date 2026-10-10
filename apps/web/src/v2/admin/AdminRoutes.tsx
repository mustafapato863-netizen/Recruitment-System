import { lazy, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { UsersV2 } from './UsersV2';
import { RolesV2 } from './RolesV2';

const UsersRolesPage = lazy(() => import('../../pages/UsersRolesPage').then((m) => ({ default: m.UsersRolesPage })));

/** v2 Admin pages render only for the v2 Admin seat; everyone else keeps v1 (flag off, other seats). */
export function AdminOnly({ v2, v1 }: { v2: ReactNode; v1: ReactNode }) {
  return <>{useV2Shell()?.seat === 'admin' ? v2 : v1}</>;
}
export const UsersRoute = () => <AdminOnly v2={<UsersV2 />} v1={<UsersRolesPage />} />;
/** /roles is v2-only; v1 keeps roles inside /users. */
export const RolesRoute = () => <AdminOnly v2={<RolesV2 />} v1={<Navigate to="/users" replace />} />;
