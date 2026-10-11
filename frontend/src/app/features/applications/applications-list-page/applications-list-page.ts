import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Auth } from '../../../core/auth/auth';
import { Role } from '../../../core/auth/role';
import { ApplicationsApi } from '../../../core/applications/applications-api';
import { Application, ApplicationStatus } from '../../../core/applications/application.model';
import { Realtime } from '../../../core/realtime/realtime';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; items: Application[]; total: number };

const STATUS_OPTIONS: { value: ApplicationStatus | null; label: string }[] = [
  { value: null, label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

@Component({
  selector: 'app-applications-list-page',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
  ],
  templateUrl: './applications-list-page.html',
  styleUrl: './applications-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationsListPage {
  private readonly api = inject(ApplicationsApi);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly realtime = inject(Realtime);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly Role = Role;
  protected readonly role = this.auth.role;
  protected readonly statusOptions = STATUS_OPTIONS;
  private static readonly BASE_COLUMNS = [
    'legalBusinessName',
    'status',
    'ownerName',
    'assignedReviewerName',
    'estimatedMonthlyVolume',
    'updatedAt',
  ];

  protected readonly displayedColumns = computed(() =>
    this.role() === Role.Sales
      ? [...ApplicationsListPage.BASE_COLUMNS, 'actions']
      : ApplicationsListPage.BASE_COLUMNS,
  );

  protected readonly deletingId = signal<string | null>(null);

  protected readonly page = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly statusFilter = signal<ApplicationStatus | null>(this.readStatusFromQueryParam());
  protected readonly searchTerm = signal('');
  private readonly retryTick = signal(0);

  private readonly state$ = combineLatest([
    toObservable(this.page),
    toObservable(this.pageSize),
    toObservable(this.statusFilter),
    toObservable(this.searchTerm).pipe(debounceTime(300), distinctUntilChanged()),
    toObservable(this.retryTick),
  ]).pipe(
    switchMap(([page, pageSize, status, search]) =>
      this.api.list({ page: page + 1, pageSize, status, search }).pipe(
        map((response): LoadState => ({ status: 'success', items: response.items, total: response.total })),
        catchError(() => of<LoadState>({ status: 'error' })),
        startWith<LoadState>({ status: 'loading' }),
      ),
    ),
  );

  protected readonly state = toSignal(this.state$, { initialValue: { status: 'loading' } as LoadState });

  constructor() {

    effect(() => {
      if (this.realtime.statusChanged()) {
        this.retry();
      }
    });
  }

  protected onPage(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  protected onStatusChange(status: ApplicationStatus | null): void {
    this.statusFilter.set(status);
    this.page.set(0);
  }

  protected onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.page.set(0);
  }

  protected retry(): void {
    this.retryTick.update((tick) => tick + 1);
  }

  private readStatusFromQueryParam(): ApplicationStatus | null {
    const raw = this.route.snapshot.queryParamMap.get('status');
    return STATUS_OPTIONS.some((option) => option.value === raw) ? (raw as ApplicationStatus) : null;
  }

  protected openApplication(application: Application): void {
    this.router.navigate(
      this.canEdit(application) ? ['/applications', application.id, 'edit'] : ['/applications', application.id],
    );
  }

  protected statusChipClass(status: ApplicationStatus): string {
    return `status-chip status-${status.toLowerCase()}`;
  }

  protected canEdit(application: Application): boolean {
    return this.role() === Role.Sales && (application.status === 'DRAFT' || application.status === 'SUBMITTED');
  }

  protected canDelete(application: Application): boolean {
    return this.canEdit(application);
  }

  protected editApplication(event: Event, application: Application): void {
    event.stopPropagation();
    this.router.navigate(['/applications', application.id, 'edit']);
  }

  protected deleteApplication(event: Event, application: Application): void {
    event.stopPropagation();
    if (this.deletingId()) {
      return;
    }
    const confirmed = window.confirm(
      `Delete "${application.legalBusinessName || 'Untitled application'}"? This can't be undone.`,
    );
    if (!confirmed) {
      return;
    }
    this.deletingId.set(application.id);
    this.api
      .delete(application.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingId.set(null);
          this.retry();
        },
        error: () => this.deletingId.set(null),
      });
  }
}
