const { PrismaClient } = require('../apps/api/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [cand, vac, app, int, off, hire, req] = await Promise.all([
    prisma.candidate.findFirst(),
    prisma.vacancy.findFirst(),
    prisma.application.findFirst(),
    prisma.interview.findFirst(),
    prisma.offer.findFirst(),
    prisma.hiringCase.findFirst(),
    prisma.vacancyRequest.findFirst(),
  ]);

  const ids = {
    candidateId: cand?.id,
    vacancyId: vac?.id,
    applicationId: app?.id,
    interviewId: int?.id,
    offerId: off?.id,
    hiringCaseId: hire?.id,
    vacancyRequestId: req?.id,
  };
  console.log(JSON.stringify(ids, null, 2));
}

main().finally(() => prisma.$disconnect());
