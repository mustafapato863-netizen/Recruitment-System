# Import CVs: linking a bank person (B2F-2)

Decision: **create the application first, then upload.** No new endpoint.

A person in the bank who is on none of your jobs is not visible to you (B1/B2-8 scope), so
`POST /documents/upload {candidateId}` and `GET /candidates/:id` return 404 for them until they are on one of your jobs.
`POST /applications` on a job you own is allowed for any person in the organization (B2-12), and once that
file exists the person is in your scope.

Order for a row the preview marks "Duplicate · Link to <name>":

1. `POST /candidates/duplicate-check` (or the 409 `CANDIDATE_EXISTS` from `POST /candidates`, which carries
   `details: { candidateId, candidateCode }`) gives the existing person's id.
2. `POST /applications { vacancyId, candidateId }` → 201 (stage Applied). If the person is already on this job: 409 `APPLICATION_EXISTS`
   ("Already on this job"); skip to step 3 only if you still want to add the CV.
3. `POST /documents/upload { candidateId, ... }` with the CV → 201.

New people (no duplicate) keep the current order: create candidate, upload, then `POST /applications`.
Nothing about the person beyond the new file is returned to the caller before the link.
