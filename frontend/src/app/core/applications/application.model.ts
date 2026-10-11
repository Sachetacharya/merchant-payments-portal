export type ApplicationStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
export type BusinessType = 'LLC' | 'CORPORATION' | 'SOLE_PROPRIETOR' | 'PARTNERSHIP';
export type RiskDecision = 'APPROVED' | 'REJECTED' | 'FLAGGED' | 'NOTE';

export const SENSITIVE_FIELDS = ['registrationNumber', 'ownerNid', 'bankAccountNumber'] as const;
export type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

export interface RiskEvent {
  id: string;
  timestamp: string;
  decision: RiskDecision;
  reviewerId: string;
  reviewerName: string;
  notes: string;
}

export interface Application {
  id: string;
  status: ApplicationStatus;
  ownerId: string;
  ownerName: string;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  createdAt: string;
  updatedAt: string;

  legalBusinessName?: string;
  businessType?: BusinessType;
  website?: string;
  registrationNumber?: string;

  ownerFullName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  ownerNid?: string;

  bankName?: string;
  bankBranch?: string;
  bankAccountNumber?: string;

  estimatedMonthlyVolume?: number;
  averageTransactionSize?: number;

  riskHistory: RiskEvent[];
}

export type ApplicationDraftFields = Partial<
  Pick<
    Application,
    | 'legalBusinessName'
    | 'businessType'
    | 'website'
    | 'registrationNumber'
    | 'ownerFullName'
    | 'ownerEmail'
    | 'ownerPhone'
    | 'ownerNid'
    | 'bankName'
    | 'bankBranch'
    | 'bankAccountNumber'
    | 'estimatedMonthlyVolume'
    | 'averageTransactionSize'
  >
>;

export interface ApplicationListResponse {
  items: Application[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReviewerSummary {
  id: string;
  name: string;
  email: string;
}
