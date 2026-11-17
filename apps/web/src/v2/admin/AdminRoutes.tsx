import { UsersV2 } from './UsersV2';
import { RolesV2 } from './RolesV2';
import { MasterDataV2 } from './MasterDataV2';
import { PipelineV2 } from './PipelineV2';
import { TemplatesV2 } from './TemplatesV2';
import { AuditV2 } from './AuditV2';
import { IntegrationsV2 } from './IntegrationsV2';
import { LicenseManagementV2 } from './LicenseManagementV2';

/** v2 Admin pages. Only the Admin seat reaches these paths (v2/destinations.ts redirects the other seats). */
export const UsersRoute = () => <UsersV2 />;
export const RolesRoute = () => <RolesV2 />;
export const MasterDataRoute = () => <MasterDataV2 />;
export const PipelineRoute = () => <PipelineV2 />;
/** Saved email templates stay on the API for v3. This page edits WhatsApp templates only. */
export const TemplatesRoute = () => <TemplatesV2 />;
export const AuditRoute = () => <AuditV2 />;
export const IntegrationsRoute = () => <IntegrationsV2 />;
export const LicensesRoute = () => <LicenseManagementV2 />;
