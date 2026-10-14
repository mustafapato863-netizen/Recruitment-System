import { TalentPoolDetailV2, TalentPoolsListV2 } from './TalentPoolsV2';

/** /talent-pools */
export function TalentPoolsListRoute() { return <TalentPoolsListV2 />; }
/** /talent-pools/:id */
export function TalentPoolDetailRoute() { return <TalentPoolDetailV2 />; }
