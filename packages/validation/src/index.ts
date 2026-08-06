import { z } from 'zod';

export const idSchema = z.uuid();

export const vacancyRequestStatusSchema = z.enum([
  'Draft',
  'Pending Approval',
  'Changes Requested',
  'Approved',
  'Rejected',
  'Cancelled',
  'Converted to Vacancy',
]);

export type VacancyRequestStatus = z.infer<typeof vacancyRequestStatusSchema>;
