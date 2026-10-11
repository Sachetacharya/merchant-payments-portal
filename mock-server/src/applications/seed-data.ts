import { randomUUID } from 'node:crypto';
import type { StoredUser } from '../auth/users.store.js';
import type { Application, ApplicationStatus, BusinessType, RiskEvent } from './application.model.js';

function createRng(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LEGAL_NAMES = [
  'Summit Coffee Roasters',
  'Blue Harbor Fitness',
  'Northline Hardware',
  'Clearwater Dental Group',
  'Pinecrest Bakery',
  'Urban Cycle Works',
  'Golden Gate Tutoring',
  'Maple & Co. Florals',
  'Ridgeline Auto Repair',
  'Harvest Moon Market',
  'Steel City Brewing',
  'Lakeside Veterinary Clinic',
  'Coastal Print Shop',
  'Juniper Lane Boutique',
  'Ironwood Construction',
  'Sunnyvale Yoga Studio',
  'Driftwood Surf Co.',
  'Everly Home Goods',
  'Copper Kettle Catering',
  'Birchwood Bookstore',
];

const BUSINESS_TYPES: BusinessType[] = ['LLC', 'CORPORATION', 'SOLE_PROPRIETOR', 'PARTNERSHIP'];

const BANK_NAMES = [
  'First National Bank',
  'Summit Trust Bank',
  'Harborview Bank',
  'Pacific Crest Bank',
  'Meridian Savings Bank',
  'Union Point Bank',
];

const BANK_BRANCHES = [
  'Downtown Branch',
  'Main Street Branch',
  'Northside Branch',
  'Riverside Branch',
  'Uptown Branch',
  'Lakeview Branch',
];

const RISK_NOTES = [
  'Processing volume consistent with stated business model.',
  'Requested additional bank statements for verification.',
  'Elevated chargeback rate at previous processor — flagged for follow-up.',
  'Business registration number verified against state records.',
  'Owner identity verified via document upload.',
];

function pad(num: number, size: number): string {
  return num.toString().padStart(size, '0');
}

function randomRegistrationNumber(rng: () => number): string {
  return `${pad(Math.floor(rng() * 100), 2)}-${pad(Math.floor(rng() * 10_000_000), 7)}`;
}

function randomNid(rng: () => number): string {
  return `${pad(Math.floor(rng() * 1000), 3)}-${pad(Math.floor(rng() * 1000), 3)}-${pad(Math.floor(rng() * 10_000), 4)}`;
}

function randomAccountNumber(rng: () => number): string {
  return pad(Math.floor(rng() * 1_000_000_000), 10);
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function createSeedApplications(salesUsers: StoredUser[], reviewerUsers: StoredUser[]): Application[] {
  const rng = createRng(42);
  const now = Date.now();
  const applications: Application[] = [];

  LEGAL_NAMES.forEach((legalBusinessName, index) => {
    const owner = pick(rng, salesUsers);
    const createdDaysAgo = Math.floor(rng() * 60) + 1;
    const createdAt = new Date(now - createdDaysAgo * 24 * 60 * 60 * 1000).toISOString();

    const statusRoll = rng();
    let status: ApplicationStatus;
    if (statusRoll < 0.15) status = 'DRAFT';
    else if (statusRoll < 0.3) status = 'SUBMITTED';
    else if (statusRoll < 0.55) status = 'UNDER_REVIEW';
    else if (statusRoll < 0.8) status = 'APPROVED';
    else status = 'REJECTED';

    const isAssigned = status !== 'DRAFT' && status !== 'SUBMITTED';
    const reviewer = isAssigned ? pick(rng, reviewerUsers) : undefined;

    const riskHistory: RiskEvent[] = [];
    if (status === 'UNDER_REVIEW' || status === 'APPROVED' || status === 'REJECTED') {
      const noteCount = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < noteCount; i++) {
        riskHistory.push({
          id: `risk-${index}-${i}`,
          timestamp: new Date(now - (createdDaysAgo - i) * 24 * 60 * 60 * 1000).toISOString(),
          decision: 'NOTE',
          reviewerId: reviewer?.id ?? 'u-admin-1',
          reviewerName: reviewer?.name ?? 'Avery Admin',
          notes: pick(rng, RISK_NOTES),
        });
      }
      if (status === 'APPROVED' || status === 'REJECTED') {
        riskHistory.push({
          id: `risk-${index}-final`,
          timestamp: createdAt,
          decision: status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          reviewerId: reviewer?.id ?? 'u-admin-1',
          reviewerName: reviewer?.name ?? 'Avery Admin',
          notes:
            status === 'APPROVED'
              ? 'Meets underwriting criteria — approved for processing.'
              : 'Does not meet risk threshold for this merchant category.',
        });
      }
    }

    applications.push({
      id: `app-${randomUUID()}`,
      status,
      ownerId: owner.id,
      ownerName: owner.name,
      assignedReviewerId: reviewer?.id ?? null,
      assignedReviewerName: reviewer?.name ?? null,
      createdAt,
      updatedAt: createdAt,
      legalBusinessName,
      businessType: pick(rng, BUSINESS_TYPES),
      website: `https://${legalBusinessName.toLowerCase().replace(/[^a-z]+/g, '')}.example.com`,
      registrationNumber: randomRegistrationNumber(rng),
      ownerFullName: owner.name,
      ownerEmail: owner.email,
      ownerPhone: `555-${pad(Math.floor(rng() * 1000), 3)}-${pad(Math.floor(rng() * 10_000), 4)}`,
      ownerNid: randomNid(rng),
      bankName: pick(rng, BANK_NAMES),
      bankBranch: pick(rng, BANK_BRANCHES),
      bankAccountNumber: randomAccountNumber(rng),
      estimatedMonthlyVolume: Math.floor(rng() * 150_000) + 5_000,
      averageTransactionSize: Math.floor(rng() * 200) + 10,
      riskHistory,
    });
  });

  return applications;
}
