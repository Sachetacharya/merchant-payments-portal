import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import { Role } from '../../../core/auth/role';
import { ApplicationsApi } from '../../../core/applications/applications-api';
import { Application, SensitiveField } from '../../../core/applications/application.model';
import { Realtime } from '../../../core/realtime/realtime';
import { MaskedField } from '../../../shared/components/masked-field/masked-field';

type PageState = { status: 'loading' } | { status: 'error' } | { status: 'success'; application: Application };

@Component({
  selector: 'app-application-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    MaskedField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './application-detail-page.html',
  styleUrl: './application-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationDetailPage implements OnInit {
  private readonly api = inject(ApplicationsApi);
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly realtime = inject(Realtime);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly Role = Role;
  protected readonly role = this.auth.role;

  protected readonly state = signal<PageState>({ status: 'loading' });
  protected readonly revealedValues = signal<Partial<Record<SensitiveField, string>>>({});
  protected readonly revealingField = signal<SensitiveField | null>(null);
  protected readonly reviewers = signal<{ id: string; name: string }[]>([]);
  protected readonly isActingOnDecision = signal(false);
  protected readonly isAssigning = signal(false);

  protected readonly decisionForm = this.fb.nonNullable.group({
    notes: ['', [Validators.required, Validators.minLength(3)]],
  });
  protected readonly assignForm = this.fb.nonNullable.group({
    reviewerId: ['', Validators.required],
  });

  constructor() {
    effect(() => {
      const event = this.realtime.statusChanged();
      const current = this.state();
      if (event && current.status === 'success' && current.application.id === event.id) {
        if (current.application.status !== event.status) {
          this.load();
        }
      }
    });
  }

  ngOnInit(): void {
    this.load();
  }

  protected canReveal(): boolean {
    return this.role() === Role.Reviewer || this.role() === Role.Admin;
  }

  protected canDecide(application: Application): boolean {
    return this.canReveal() && application.status === 'UNDER_REVIEW';
  }

  protected canAssign(application: Application): boolean {
    return this.role() === Role.Admin && application.status === 'SUBMITTED';
  }

  protected onReveal(id: string, field: SensitiveField): void {
    if (this.revealedValues()[field] !== undefined) {
      return;
    }
    this.revealingField.set(field);
    this.api
      .reveal(id, field)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ value }) => {
          this.revealedValues.update((current) => ({ ...current, [field]: value ?? '' }));
          this.revealingField.set(null);
        },
        error: () => this.revealingField.set(null),
      });
  }

  protected decide(id: string, approved: boolean): void {
    if (this.decisionForm.invalid || this.isActingOnDecision()) {
      this.decisionForm.markAllAsTouched();
      return;
    }
    this.isActingOnDecision.set(true);
    this.api
      .recordDecision(id, approved, this.decisionForm.getRawValue().notes)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (application) => {
          this.state.set({ status: 'success', application });
          this.decisionForm.reset();
          this.isActingOnDecision.set(false);
        },
        error: () => this.isActingOnDecision.set(false),
      });
  }

  protected assign(id: string): void {
    if (this.assignForm.invalid || this.isAssigning()) {
      return;
    }
    this.isAssigning.set(true);
    this.api
      .assign(id, this.assignForm.getRawValue().reviewerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (application) => {
          this.state.set({ status: 'success', application });
          this.isAssigning.set(false);
        },
        error: () => this.isAssigning.set(false),
      });
  }

  private load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.state.set({ status: 'error' });
      return;
    }

    this.api
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (application) => this.state.set({ status: 'success', application }),
        error: () => this.state.set({ status: 'error' }),
      });

    if (this.role() === Role.Admin) {
      this.api
        .listReviewers()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (reviewers) => this.reviewers.set(reviewers),
          error: () => undefined,
        });
    }
  }
}
