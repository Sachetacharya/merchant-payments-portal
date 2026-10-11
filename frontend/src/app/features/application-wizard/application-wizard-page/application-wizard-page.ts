import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { ApplicationsApi } from '../../../core/applications/applications-api';
import {
  Application,
  ApplicationDraftFields,
  ApplicationStatus,
  BusinessType,
} from '../../../core/applications/application.model';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const BUSINESS_TYPES: BusinessType[] = ['LLC', 'CORPORATION', 'SOLE_PROPRIETOR', 'PARTNERSHIP'];
const LOCAL_DRAFT_PREFIX = 'merchant-portal.draft.';

@Component({
  selector: 'app-application-wizard-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatStepperModule,
    MatTooltipModule,
  ],
  templateUrl: './application-wizard-page.html',
  styleUrl: './application-wizard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationWizardPage implements OnInit {
  private readonly api = inject(ApplicationsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly businessTypes = BUSINESS_TYPES;
  protected readonly applicationId = signal<string | null>(null);
  protected readonly applicationStatus = signal<ApplicationStatus>('DRAFT');
  protected readonly saveStatus = signal<SaveStatus>('idle');
  protected readonly isSubmitting = signal(false);
  protected readonly loadError = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    businessInfo: this.fb.nonNullable.group({
      legalBusinessName: ['', [Validators.required, Validators.minLength(2)]],
      businessType: ['' as BusinessType | '', Validators.required],
      website: ['', Validators.pattern(/^https?:\/\/.+\..+/)],
      registrationNumber: ['', [Validators.required, Validators.pattern(/^\d{2}-\d{7}$/)]],
    }),
    ownerInfo: this.fb.nonNullable.group({
      ownerFullName: ['', Validators.required],
      ownerEmail: ['', [Validators.required, Validators.email]],
      ownerPhone: ['', Validators.required],
      ownerNid: ['', [Validators.required, Validators.pattern(/^\d{3}-\d{3}-\d{4}$/)]],
    }),
    banking: this.fb.nonNullable.group({
      bankName: ['', Validators.required],
      bankBranch: ['', Validators.required],
      bankAccountNumber: ['', [Validators.required, Validators.pattern(/^\d{4,17}$/)]],
    }),
    processingEstimate: this.fb.nonNullable.group({
      estimatedMonthlyVolume: [0, [Validators.required, Validators.min(1)]],
      averageTransactionSize: [0, Validators.required],
    }),
  });

  ngOnInit(): void {
    this.initializeDraft();
    this.setupAutosave();
  }

  protected submit(): void {
    const id = this.applicationId();
    if (!id || this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.api
      .submit(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.clearLocalDraft(id);
          this.router.navigate(['/applications', id]);
        },
        error: () => this.isSubmitting.set(false),
      });
  }

  private initializeDraft(): void {
    const existingId = this.route.snapshot.paramMap.get('id');

    if (existingId) {
      this.applicationId.set(existingId);
      this.api
        .getById(existingId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (application) => this.hydrateForm(existingId, application),
          error: () => this.loadError.set(true),
        });
      return;
    }

    this.api
      .create()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (application) => {
          this.applicationId.set(application.id);
          this.router.navigate(['/applications', application.id, 'edit'], { replaceUrl: true });
        },
        error: () => this.loadError.set(true),
      });
  }

  private hydrateForm(id: string, application: Application): void {
    this.applicationStatus.set(application.status);
    this.form.patchValue(
      {
        businessInfo: {
          legalBusinessName: application.legalBusinessName ?? '',
          businessType: application.businessType ?? '',
          website: application.website ?? '',
          registrationNumber: application.registrationNumber ?? '',
        },
        ownerInfo: {
          ownerFullName: application.ownerFullName ?? '',
          ownerEmail: application.ownerEmail ?? '',
          ownerPhone: application.ownerPhone ?? '',
          ownerNid: application.ownerNid ?? '',
        },
        banking: {
          bankName: application.bankName ?? '',
          bankBranch: application.bankBranch ?? '',
          bankAccountNumber: application.bankAccountNumber ?? '',
        },
        processingEstimate: {
          estimatedMonthlyVolume: application.estimatedMonthlyVolume ?? 0,
          averageTransactionSize: application.averageTransactionSize ?? 0,
        },
      },
      { emitEvent: false },
    );

    const local = this.readLocalDraft(id);
    if (local && local.savedAt > new Date(application.updatedAt).getTime()) {
      this.form.patchValue(local.value as Partial<ReturnType<typeof this.form.getRawValue>>, { emitEvent: false });
    }
  }

  private setupAutosave(): void {
    this.form.valueChanges
      .pipe(
        debounceTime(800),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap(() => {
          const id = this.applicationId();
          if (!id) {
            return EMPTY;
          }
          const value = this.form.getRawValue();
          this.saveLocalDraft(id, value);
          this.saveStatus.set('saving');
          return this.api.update(id, this.flatten(value)).pipe(
            map(() => 'saved' as const),
            catchError(() => of('error' as const)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((status) => this.saveStatus.set(status));
  }

  private flatten(value: ReturnType<typeof this.form.getRawValue>): ApplicationDraftFields {
    const merged: Record<string, unknown> = {
      ...value.businessInfo,
      ...value.ownerInfo,
      ...value.banking,
      ...value.processingEstimate,
    };
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(merged)) {
      if (val !== '' && val !== null && val !== undefined) {
        cleaned[key] = val;
      }
    }
    return cleaned as ApplicationDraftFields;
  }

  private saveLocalDraft(id: string, value: unknown): void {
    try {
      localStorage.setItem(`${LOCAL_DRAFT_PREFIX}${id}`, JSON.stringify({ value, savedAt: Date.now() }));
    } catch {}
  }

  private readLocalDraft(id: string): { value: unknown; savedAt: number } | null {
    try {
      const raw = localStorage.getItem(`${LOCAL_DRAFT_PREFIX}${id}`);
      return raw ? (JSON.parse(raw) as { value: unknown; savedAt: number }) : null;
    } catch {
      return null;
    }
  }

  private clearLocalDraft(id: string): void {
    try {
      localStorage.removeItem(`${LOCAL_DRAFT_PREFIX}${id}`);
    } catch {}
  }
}
