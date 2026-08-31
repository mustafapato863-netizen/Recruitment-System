/**
 * Read-only Database Integrity & Relational Audit Script
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { PrismaClient } = require('../generated/client');
const prisma = new PrismaClient();

async function runIntegrityAudit() {
  console.log('======================================================================');
  console.log('RECRUITFLOW DATABASE INTEGRITY & TENANT ISOLATION AUDIT');
  console.log('======================================================================\n');

  const results = {
    orphanApplications: 0,
    orphanOffers: 0,
    orphanHiringCases: 0,
    crossOrgApplications: 0,
    crossOrgOffers: 0,
    crossOrgHiringCases: 0,
    duplicateCandidateEmails: 0,
    duplicateActiveApplications: 0,
    headcountViolations: 0,
  };

  try {
    // 1. Check Applications relations
    const applications = await prisma.application.findMany({
      include: {
        candidate: true,
        vacancy: true,
        organization: true,
      },
    });

    for (const app of applications) {
      if (!app.candidate || !app.vacancy) {
        results.orphanApplications++;
      }
      if (app.candidate && app.candidate.organizationId !== app.organizationId) {
        results.crossOrgApplications++;
      }
      if (app.vacancy && app.vacancy.organizationId !== app.organizationId) {
        results.crossOrgApplications++;
      }
    }

    // 2. Check Offers relations
    const offers = await prisma.offer.findMany({
      include: {
        application: {
          include: { candidate: true },
        },
      },
    });

    for (const offer of offers) {
      if (!offer.application) {
        results.orphanOffers++;
      } else if (offer.application.organizationId !== offer.organizationId) {
        results.crossOrgOffers++;
      }
    }

    // 3. Check Hiring Cases relations
    const hiringCases = await prisma.hiringCase.findMany({
      include: {
        offer: true,
        application: true,
      },
    });

    for (const hc of hiringCases) {
      if (!hc.offer || !hc.application) {
        results.orphanHiringCases++;
      }
      if (hc.offer && hc.offer.organizationId !== hc.organizationId) {
        results.crossOrgHiringCases++;
      }
      if (hc.application && hc.application.organizationId !== hc.organizationId) {
        results.crossOrgHiringCases++;
      }
    }

    // 4. Check Vacancy Headcounts
    const vacancies = await prisma.vacancy.findMany();
    for (const vac of vacancies) {
      if (vac.joinedHeadcount > vac.approvedHeadcount) {
        results.headcountViolations++;
      }
    }

    // 5. Check Candidate Email Uniqueness per Org
    const candidates = await prisma.candidate.findMany();
    const candidateMap = new Map();
    for (const cand of candidates) {
      const key = `${cand.organizationId}:${cand.email.toLowerCase().trim()}`;
      if (candidateMap.has(key)) {
        results.duplicateCandidateEmails++;
      } else {
        candidateMap.set(key, true);
      }
    }

    // 6. Check Duplicate Active Applications (same vacancy + candidate)
    const appMap = new Map();
    for (const app of applications) {
      const key = `${app.vacancyId}:${app.candidateId}`;
      if (appMap.has(key)) {
        results.duplicateActiveApplications++;
      } else {
        appMap.set(key, true);
      }
    }

    const violations = Object.entries(results).filter(([, count]) => count > 0);
    console.log('--- INTEGRITY AUDIT RESULTS ---');
    for (const [name, count] of Object.entries(results)) {
      console.log(`[${count === 0 ? 'PASS' : 'FAIL'}] ${name}: ${count}`);
    }

    if (violations.length > 0) {
      process.exitCode = 1;
      console.error(`\nIntegrity audit found ${violations.length} violation category(ies).`);
    } else {
      console.log('\nIntegrity audit completed successfully with 0 violations.');
    }
  } catch (error) {
    console.error('Integrity audit encountered an error:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runIntegrityAudit();
