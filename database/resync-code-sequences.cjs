const { PrismaClient } = require('./generated/client');

async function resync() {
  const p = new PrismaClient();
  const year = new Date().getUTCFullYear();

  const seqKeys = [
    { key: `CND:${year}`, model: 'candidate', codeField: 'candidateCode', prefix: 'CND' },
    { key: `APP:${year}`, model: 'application', codeField: 'applicationCode', prefix: 'APP' },
    { key: `INT:${year}`, model: 'interview', codeField: 'interviewCode', prefix: 'INT' },
    { key: `OFF:${year}`, model: 'offer', codeField: 'offerCode', prefix: 'OFF' },
    { key: `VR:${year}`, model: 'vacancyRequest', codeField: 'requestCode', prefix: 'VR' },
    { key: `VAC:${year}`, model: 'vacancy', codeField: 'vacancyCode', prefix: 'VAC' },
  ];

  for (const { key, model, codeField, prefix } of seqKeys) {
    const records = await p[model].findMany({
      where: { [codeField]: { startsWith: `${prefix}-${year}-` } },
      select: { [codeField]: true },
      orderBy: { [codeField]: 'desc' },
    });

    let maxSeq = 0;
    for (const r of records) {
      const code = r[codeField];
      const match = code.match(new RegExp(`${prefix}-\\d{4}-(\\d+)`));
      if (match && match[1]) {
        maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
      }
    }

    if (maxSeq > 0) {
      // Update the sequence to max (next call will increment to maxSeq+1)
      await p.codeSequence.upsert({
        where: { key },
        create: { key, lastIssued: maxSeq },
        update: { lastIssued: maxSeq },
      });
      console.log(`${key}: synced to maxSeq=${maxSeq} (next code will be ${maxSeq + 1})`);
    } else {
      console.log(`${key}: no existing records, sequence starts at 0 (first code will be 1)`);
    }
  }

  // Show final state
  const all = await p.codeSequence.findMany();
  console.log('\nFinal code_sequences table:', JSON.stringify(all, null, 2));

  await p.$disconnect();
}

resync().catch(console.error);
