-- CreateTable
CREATE TABLE "candidate_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "documentType" VARCHAR(60) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "extractionText" TEXT,
    "scanStatus" VARCHAR(40) NOT NULL DEFAULT 'Clean',
    "uploadedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "candidate_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "screenerId" UUID NOT NULL,
    "outcome" VARCHAR(40) NOT NULL,
    "notes" TEXT,
    "screenedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screening_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "interviewCode" VARCHAR(50) NOT NULL,
    "applicationId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "interviewType" VARCHAR(60) NOT NULL,
    "scheduledStart" TIMESTAMPTZ(6) NOT NULL,
    "scheduledEnd" TIMESTAMPTZ(6) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "locationUrl" VARCHAR(500),
    "status" VARCHAR(40) NOT NULL DEFAULT 'Scheduled',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_attendees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "interviewId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" VARCHAR(60) NOT NULL DEFAULT 'Interviewer',
    "response" VARCHAR(40) NOT NULL DEFAULT 'Accepted',

    CONSTRAINT "interview_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_scorecards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "interviewId" UUID NOT NULL,
    "interviewerId" UUID NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "recommendation" VARCHAR(40) NOT NULL,
    "strengths" TEXT,
    "concerns" TEXT,
    "notes" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidate_documents_organizationId_candidateId_idx" ON "candidate_documents"("organizationId", "candidateId");
CREATE INDEX "candidate_documents_candidateId_documentType_idx" ON "candidate_documents"("candidateId", "documentType");

-- CreateIndex
CREATE INDEX "screening_logs_organizationId_applicationId_idx" ON "screening_logs"("organizationId", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_interviewCode_key" ON "interviews"("interviewCode");
CREATE INDEX "interviews_organizationId_status_idx" ON "interviews"("organizationId", "status");
CREATE INDEX "interviews_applicationId_scheduledStart_idx" ON "interviews"("applicationId", "scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "interview_attendees_interviewId_userId_key" ON "interview_attendees"("interviewId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_scorecards_interviewId_interviewerId_key" ON "interview_scorecards"("interviewId", "interviewerId");

-- AddForeignKey
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_logs" ADD CONSTRAINT "screening_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "screening_logs" ADD CONSTRAINT "screening_logs_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "screening_logs" ADD CONSTRAINT "screening_logs_screenerId_fkey" FOREIGN KEY ("screenerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_attendees" ADD CONSTRAINT "interview_attendees_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_attendees" ADD CONSTRAINT "interview_attendees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
