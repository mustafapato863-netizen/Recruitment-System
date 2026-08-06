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

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const createVacancyRequestSchema = z.object({
  organizationId: idSchema,
  legalEntityId: idSchema.nullable().optional(),
  branchId: idSchema,
  positionId: idSchema,
  requesterId: idSchema,
  requestedHeadcount: z.coerce.number().int().min(1).max(10_000),
  employmentType: optionalText(60),
  reason: optionalText(120),
  budgetStatus: optionalText(60),
  criticality: optionalText(40),
  targetStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  justification: optionalText(5_000),
});

export const vacancyRequestActionSchema = z.object({
  comment: z.string().trim().max(1_000).optional(),
});
