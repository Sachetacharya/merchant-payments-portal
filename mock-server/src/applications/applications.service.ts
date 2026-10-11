import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedRequestUser } from '../common/guards/jwt-auth.guard.js';
import { Role } from '../auth/role.enum.js';
import { UsersStore } from '../auth/users.store.js';
import type { Application, ApplicationDraftFields, RiskEvent, SensitiveField } from './application.model.js';
import { toPublicApplication } from './application.mapper.js';
import { ApplicationsGateway } from './applications.gateway.js';
import { ApplicationsStore } from './applications.store.js';
import type { DecisionDto } from './dto/decision.dto.js';
import type { ListQueryDto } from './dto/list-query.dto.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly store: ApplicationsStore,
    private readonly usersStore: UsersStore,
    private readonly gateway: ApplicationsGateway,
  ) {}

  list(user: AuthenticatedRequestUser, query: ListQueryDto) {
    let scoped = this.store.findAll();

    if (user.role === Role.Sales) {
      scoped = scoped.filter((application) => application.ownerId === user.sub);
    } else if (user.role === Role.Reviewer) {
      scoped = scoped.filter((application) => application.assignedReviewerId === user.sub);
    }

    if (query.status) {
      scoped = scoped.filter((application) => application.status === query.status);
    }
    if (query.search) {
      const term = query.search.toLowerCase();
      scoped = scoped.filter(
        (application) =>
          application.legalBusinessName?.toLowerCase().includes(term) ||
          application.ownerName.toLowerCase().includes(term),
      );
    }

    scoped = [...scoped].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const total = scoped.length;
    const start = (page - 1) * pageSize;

    return {
      items: scoped
        .slice(start, start + pageSize)
        .map((application) => toPublicApplication(application, { unmask: this.isOwner(user, application) })),
      total,
      page,
      pageSize,
    };
  }

  statusCounts(user: AuthenticatedRequestUser): Record<Application['status'], number> {
    let scoped = this.store.findAll();
    if (user.role === Role.Sales) {
      scoped = scoped.filter((application) => application.ownerId === user.sub);
    } else if (user.role === Role.Reviewer) {
      scoped = scoped.filter((application) => application.assignedReviewerId === user.sub);
    }

    const counts: Record<Application['status'], number> = {
      DRAFT: 0,
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      APPROVED: 0,
      REJECTED: 0,
    };
    for (const application of scoped) {
      counts[application.status] += 1;
    }
    return counts;
  }

  findOne(user: AuthenticatedRequestUser, id: string) {
    const application = this.getVisibleOrThrow(user, id);
    return toPublicApplication(application, { unmask: this.isOwner(user, application) });
  }

  create(user: AuthenticatedRequestUser) {
    if (user.role !== Role.Sales) {
      throw new ForbiddenException('Only SALES can create applications');
    }
    return toPublicApplication(this.store.create(user.sub, user.name), { unmask: true });
  }

  update(user: AuthenticatedRequestUser, id: string, patch: ApplicationDraftFields) {
    const application = this.getOwnedEditableOrThrow(user, id);
    return toPublicApplication(this.store.update(application.id, patch)!, { unmask: true });
  }

  submit(user: AuthenticatedRequestUser, id: string) {
    const application = this.getOwnedDraftOrThrow(user, id);
    const updated = this.store.submit(application.id)!;
    this.gateway.emitStatusChange(updated.id, updated.status);
    return toPublicApplication(updated, { unmask: true });
  }

  delete(user: AuthenticatedRequestUser, id: string): void {
    const application = this.getOwnedEditableOrThrow(user, id);
    this.store.delete(application.id);
  }

  assign(id: string, reviewerId: string) {
    const application = this.store.findById(id);
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    const reviewer = this.usersStore.findById(reviewerId);
    if (!reviewer || reviewer.role !== Role.Reviewer) {
      throw new ForbiddenException('reviewerId must belong to a REVIEWER user');
    }
    const updated = this.store.assign(id, reviewer.id, reviewer.name)!;
    this.gateway.emitStatusChange(updated.id, updated.status);
    return toPublicApplication(updated);
  }

  recordDecision(user: AuthenticatedRequestUser, id: string, dto: DecisionDto) {
    const application = this.getVisibleOrThrow(user, id);
    if (application.status !== 'UNDER_REVIEW') {
      throw new ForbiddenException('Only applications under review can receive a decision');
    }

    const event: RiskEvent = {
      id: `risk-${randomUUID()}`,
      timestamp: new Date().toISOString(),
      decision: dto.approved ? 'APPROVED' : 'REJECTED',
      reviewerId: user.sub,
      reviewerName: user.name,
      notes: dto.notes,
    };

    const updated = this.store.recordDecision(application.id, event, dto.approved ? 'APPROVED' : 'REJECTED')!;
    this.gateway.emitStatusChange(updated.id, updated.status);
    return toPublicApplication(updated);
  }

  reveal(user: AuthenticatedRequestUser, id: string, field: SensitiveField) {
    const application = this.getVisibleOrThrow(user, id);

    console.log(
      `[AUDIT] ${new Date().toISOString()} user=${user.sub} role=${user.role} revealed field="${field}" application=${id}`,
    );

    return { field, value: application[field] ?? null };
  }

  private isOwner(user: AuthenticatedRequestUser, application: Application): boolean {
    return user.role === Role.Sales && application.ownerId === user.sub;
  }

  private getVisibleOrThrow(user: AuthenticatedRequestUser, id: string): Application {
    const application = this.store.findById(id);
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (user.role === Role.Admin) {
      return application;
    }
    if (user.role === Role.Sales && application.ownerId === user.sub) {
      return application;
    }
    if (user.role === Role.Reviewer && application.assignedReviewerId === user.sub) {
      return application;
    }
    throw new ForbiddenException('You do not have access to this application');
  }

  private getOwnedDraftOrThrow(user: AuthenticatedRequestUser, id: string): Application {
    const application = this.store.findById(id);
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (application.ownerId !== user.sub) {
      throw new ForbiddenException('You do not own this application');
    }
    if (application.status !== 'DRAFT') {
      throw new ForbiddenException('Only draft applications can be submitted');
    }
    return application;
  }

  private getOwnedEditableOrThrow(user: AuthenticatedRequestUser, id: string): Application {
    const application = this.store.findById(id);
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (application.ownerId !== user.sub) {
      throw new ForbiddenException('You do not own this application');
    }
    if (application.status !== 'DRAFT' && application.status !== 'SUBMITTED') {
      throw new ForbiddenException('Only draft or submitted applications can be edited');
    }
    return application;
  }
}
