const { PrismaClient } = require('./generated/client');

async function check() {
  const p = new PrismaClient();
  try {
    const candidates = await p.candidate.findMany({
      where: { candidateCode: { startsWith: 'CND-2026-' } },
      select: { candidateCode: true, organizationId: true, email: true },
      orderBy: { candidateCode: 'asc' },
    });
    console.log('Existing CND-2026 candidates:', JSON.stringify(candidates, null, 2));
  } catch(e) {
    console.log('ERROR:', e.message.split('\n')[0]);
  }
  await p.$disconnect();
}

check().catch(console.error);
