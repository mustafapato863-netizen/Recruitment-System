-- AlterTable
ALTER TABLE "application_status_histories" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "applications" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "candidate_documents" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "candidates" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "interview_attendees" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "interview_scorecards" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "interviews" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "screening_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "last_login_at",
DROP COLUMN "password_hash",
DROP COLUMN "token_version";

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "offerCode" VARCHAR(50) NOT NULL,
    "currentVersionId" UUID,
    "status" VARCHAR(50) NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_versions" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "monthlyPackage" DECIMAL(12,2),
    "annualFixed" DECIMAL(12,2),
    "contractType" VARCHAR(100),
    "probationPeriod" VARCHAR(100),
    "offerExpiry" TIMESTAMPTZ(6),
    "proposedJoiningDate" TIMESTAMPTZ(6),
    "workLocation" VARCHAR(200),
    "workingSchedule" VARCHAR(100),
    "approvalStatus" VARCHAR(50) NOT NULL DEFAULT 'Draft',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "offer_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_components" (
    "id" UUID NOT NULL,
    "offerVersionId" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "amount" DECIMAL(12,2),
    "currency" VARCHAR(10),
    "frequency" VARCHAR(50),
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "offer_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_approvals" (
    "id" UUID NOT NULL,
    "offerVersionId" UUID NOT NULL,
    "approverUserId" UUID,
    "roleCode" VARCHAR(80) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'Pending',
    "comment" TEXT,
    "decidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "offer_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "offers_offerCode_key" ON "offers"("offerCode");

-- CreateIndex
CREATE INDEX "offers_organizationId_status_idx" ON "offers"("organizationId", "status");

-- CreateIndex
CREATE INDEX "offers_applicationId_idx" ON "offers"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "offer_versions_offerId_versionNumber_key" ON "offer_versions"("offerId", "versionNumber");

-- CreateIndex
CREATE INDEX "offer_components_offerVersionId_idx" ON "offer_components"("offerVersionId");

-- CreateIndex
CREATE INDEX "offer_approvals_offerVersionId_idx" ON "offer_approvals"("offerVersionId");

-- CreateIndex
CREATE INDEX "offer_approvals_approverUserId_status_idx" ON "offer_approvals"("approverUserId", "status");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_versions" ADD CONSTRAINT "offer_versions_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_components" ADD CONSTRAINT "offer_components_offerVersionId_fkey" FOREIGN KEY ("offerVersionId") REFERENCES "offer_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_approvals" ADD CONSTRAINT "offer_approvals_offerVersionId_fkey" FOREIGN KEY ("offerVersionId") REFERENCES "offer_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_approvals" ADD CONSTRAINT "offer_approvals_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
