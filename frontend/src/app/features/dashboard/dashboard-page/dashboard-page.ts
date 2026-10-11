import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import { Role } from '../../../core/auth/role';
import { ApplicationStatus } from '../../../core/applications/application.model';
import { ApplicationsApi, StatusCounts } from '../../../core/applications/applications-api';
import { Realtime, StatusChangedEvent } from '../../../core/realtime/realtime';

interface StatusCard {
  status: ApplicationStatus;
  label: string;
  count: number;
}

interface QuickInfo {
  status: ApplicationStatus;
  message: string;
}

const STATUS_ORDER: ApplicationStatus[] = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];
const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  private readonly api = inject(ApplicationsApi);
  private readonly auth = inject(Auth);
  private readonly realtime = inject(Realtime);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly Role = Role;
  protected readonly role = this.auth.role;

  protected readonly statusCounts = signal<StatusCounts | null>(null);

  protected readonly cards = signal<StatusCard[]>([]);
  protected readonly total = signal(0);

  protected readonly quickInfo = computed<QuickInfo | null>(() => {
    const counts = this.statusCounts();
    if (!counts) {
      return null;
    }
    switch (this.role()) {
      case Role.Sales:
        return { status: 'DRAFT', message: `${counts.DRAFT} draft${counts.DRAFT === 1 ? '' : 's'} not yet submitted` };
      case Role.Reviewer:
        return {
          status: 'UNDER_REVIEW',
          message: `${counts.UNDER_REVIEW} assigned to you under review`,
        };
      case Role.Admin:
        return {
          status: 'SUBMITTED',
          message: `${counts.SUBMITTED} submitted application${counts.SUBMITTED === 1 ? '' : 's'} awaiting assignment`,
        };
      default:
        return null;
    }
  });

  private lastHandledEvent: StatusChangedEvent | null = this.realtime.statusChanged();

  constructor() {
    effect(() => {
      const event = this.realtime.statusChanged();
      if (event && event !== this.lastHandledEvent) {
        this.lastHandledEvent = event;
        this.refreshStatusCounts();
      }
    });
  }

  ngOnInit(): void {
    this.refreshStatusCounts();
  }

  protected statusCardClass(status: ApplicationStatus): string {
    return `stat-card status-${status.toLowerCase()}`;
  }

  private refreshStatusCounts(): void {
    this.api
      .statusCounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((counts) => {
        this.statusCounts.set(counts);
        this.cards.set(STATUS_ORDER.map((status) => ({ status, label: STATUS_LABELS[status], count: counts[status] })));
        this.total.set(STATUS_ORDER.reduce((sum, status) => sum + counts[status], 0));
      });
  }
}
