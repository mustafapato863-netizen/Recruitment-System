import { getPermissionLabel } from '@recruitflow/contracts';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type {
  Application,
  ApplicationWorkspaceResponse,
  ApplicationWorkspaceStage,
  ComplianceStatus,
  HiringCase,
  Interview,
  Offer,
  OfferComponentItem,
  ScreeningLog,
  ScreeningOutcome,
} from '@recruitflow/contracts';
import { getApi, patchApi, postApi } from '../../api/client';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PageState } from '../ui/PageState';
import { Icon } from '../Icon';
import { FastScorecardModal } from '../interview/FastScorecardModal';
import { SkillTagsOverflow } from './SkillTagsOverflow';
import { inferPriorityFromTitle } from './skillTags';

export { ApplicantStageWorkspace } from './ApplicantStageWorkspaceImpl';
export type ApplicantWorkspaceStage = 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Pre-Hire' | 'Joined';
