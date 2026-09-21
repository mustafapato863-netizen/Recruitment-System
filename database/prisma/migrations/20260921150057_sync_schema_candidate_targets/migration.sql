-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "service_heartbeats" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "recruiter_targets" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "recruiterId" UUID NOT NULL,
    "setById" UUID NOT NULL,
    "period" VARCHAR(10) NOT NULL,
    "month" VARCHAR(7),
    "calls" INTEGER NOT NULL DEFAULT 0,
    "screenings" INTEGER NOT NULL DEFAULT 0,
    "interviews" INTEGER NOT NULL DEFAULT 0,
    "offers" INTEGER NOT NULL DEFAULT 0,
    "hires" INTEGER NOT NULL DEFAULT 0,
    "cvSourced" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recruiter_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recruiter_targets_organizationId_recruiterId_isActive_idx" ON "recruiter_targets"("organizationId", "recruiterId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "recruiter_targets_organizationId_recruiterId_period_month_key" ON "recruiter_targets"("organizationId", "recruiterId", "period", "month");

-- AddForeignKey
ALTER TABLE "recruiter_targets" ADD CONSTRAINT "recruiter_targets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_targets" ADD CONSTRAINT "recruiter_targets_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_targets" ADD CONSTRAINT "recruiter_targets_setById_fkey" FOREIGN KEY ("setById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
