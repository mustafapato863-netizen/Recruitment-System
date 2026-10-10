-- C3: one master-data base for all reason lists. Hold/close were seeded by 20261010_b3_req_job_lifecycle;
-- this adds rejection-reasons and reassign-reasons per org on the same base. Data only, idempotent.
INSERT INTO "master_data_values" ("id", "organizationId", "category", "code", "name", "status", "version", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", v.category, v.code, v.name, 'Active', 1, now(), now()
FROM "organizations" o
CROSS JOIN (VALUES
  ('rejection-reasons', 'REQ_CANCELLED', 'Requisition cancelled'),
  ('rejection-reasons', 'DECLINED_OFFER', 'Declined offer'),
  ('rejection-reasons', 'WITHDRAWN_BY_CANDIDATE', 'Withdrawn by candidate'),
  ('rejection-reasons', 'NOT_QUALIFIED', 'Not qualified'),
  ('rejection-reasons', 'FAILED_SCREENING', 'Did not pass screening'),
  ('rejection-reasons', 'FAILED_INTERVIEW', 'Did not pass interview'),
  ('rejection-reasons', 'NO_RESPONSE', 'No response from candidate'),
  ('rejection-reasons', 'POSITION_FILLED', 'Position filled'),
  ('reassign-reasons', 'WORKLOAD_BALANCING', 'Workload balancing'),
  ('reassign-reasons', 'OWNER_ON_LEAVE', 'Owner on leave'),
  ('reassign-reasons', 'OWNER_LEAVING', 'Owner leaving'),
  ('reassign-reasons', 'SPECIALIST_NEEDED', 'Specialist needed'),
  ('reassign-reasons', 'OTHER', 'Other')
) AS v(category, code, name)
ON CONFLICT DO NOTHING;
