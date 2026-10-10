-- M1 (B3 follow-up): requisition department from master data (category 'departments'). Additive, nullable.
ALTER TABLE "vacancy_requests" ADD COLUMN "departmentId" UUID;
ALTER TABLE "vacancy_requests" ADD CONSTRAINT "vacancy_requests_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "master_data_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
