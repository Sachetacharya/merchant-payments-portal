import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Role } from '../auth/role.enum.js';
import { UsersStore } from '../auth/users.store.js';
import type { Application, ApplicationDraftFields, RiskEvent } from './application.model.js';
import { createSeedApplications } from './seed-data.js';

@Injectable()
export class ApplicationsStore {
  private readonly applications: Application[];

  constructor(usersStore: UsersStore) {
    this.applications = createSeedApplications(
      usersStore.listByRole(Role.Sales),
      usersStore.listByRole(Role.Reviewer),
    );
  }

  findAll(): Application[] {
    return this.applications;
  }

  findById(id: string): Application | undefined {
    return this.applications.find((application) => application.id === id);
  }

  create(ownerId: string, ownerName: string): Application {
    const now = new Date().toISOString();
    const application: Application = {
      id: `app-${randomUUID()}`,
      status: 'DRAFT',
      ownerId,
      ownerName,
      assignedReviewerId: null,
      assignedReviewerName: null,
      createdAt: now,
      updatedAt: now,
      riskHistory: [],
    };
    this.applications.unshift(application);
    return application;
  }

  update(id: string, patch: ApplicationDraftFields): Application | undefined {
    const application = this.findById(id);
    if (!application) {
      return undefined;
    }
    Object.assign(application, patch, { updatedAt: new Date().toISOString() });
    return application;
  }

  submit(id: string): Application | undefined {
    const application = this.findById(id);
    if (!application) {
      return undefined;
    }
    application.status = 'SUBMITTED';
    application.updatedAt = new Date().toISOString();
    return application;
  }

  assign(id: string, reviewerId: string, reviewerName: string): Application | undefined {
    const application = this.findById(id);
    if (!application) {
      return undefined;
    }
    application.assignedReviewerId = reviewerId;
    application.assignedReviewerName = reviewerName;
    application.status = 'UNDER_REVIEW';
    application.updatedAt = new Date().toISOString();
    return application;
  }

  delete(id: string): boolean {
    const index = this.applications.findIndex((application) => application.id === id);
    if (index === -1) {
      return false;
    }
    this.applications.splice(index, 1);
    return true;
  }

  recordDecision(id: string, event: RiskEvent, finalStatus: 'APPROVED' | 'REJECTED'): Application | undefined {
    const application = this.findById(id);
    if (!application) {
      return undefined;
    }
    application.riskHistory.push(event);
    application.status = finalStatus;
    application.updatedAt = new Date().toISOString();
    return application;
  }
}
