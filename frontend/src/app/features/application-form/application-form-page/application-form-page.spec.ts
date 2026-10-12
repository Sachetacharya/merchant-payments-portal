import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApplicationsApi } from '../../../core/applications/applications-api';
import { Application } from '../../../core/applications/application.model';
import { ApplicationFormPage } from './application-form-page';

function makeApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: 'app-1',
    status: 'DRAFT',
    ownerId: 'u-sales-1',
    ownerName: 'Sam Sales',
    assignedReviewerId: null,
    assignedReviewerName: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    riskHistory: [],
    ...overrides,
  };
}

describe('ApplicationFormPage', () => {
  let api: { create: ReturnType<typeof vi.fn>; getById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; submit: ReturnType<typeof vi.fn> };
  let navigateSpy: ReturnType<typeof vi.fn>;

  function createComponent(routeId: string | null): ComponentFixture<ApplicationFormPage> {
    TestBed.configureTestingModule({
      imports: [ApplicationFormPage],
      providers: [
        { provide: ApplicationsApi, useValue: api },
        { provide: Router, useValue: { navigate: navigateSpy } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(routeId ? { id: routeId } : {}) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApplicationFormPage);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    localStorage.clear();
    navigateSpy = vi.fn();
    api = {
      create: vi.fn().mockReturnValue(of(makeApplication({ id: 'new-app' }))),
      getById: vi.fn().mockReturnValue(of(makeApplication())),
      update: vi.fn().mockReturnValue(of(makeApplication())),
      submit: vi.fn().mockReturnValue(of(makeApplication({ status: 'SUBMITTED' }))),
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('starting a brand-new draft (no :id in the route)', () => {
    it('creates a draft, stores its id, and swaps the URL with replaceUrl', () => {
      const fixture = createComponent(null);
      const component = fixture.componentInstance;

      expect(api.create).toHaveBeenCalledTimes(1);
      expect((component as any).applicationId()).toBe('new-app');
      expect(navigateSpy).toHaveBeenCalledWith(
        ['/applications', 'new-app', 'edit'],
        { replaceUrl: true },
      );
    });
  });

  describe('resuming an existing draft (:id present)', () => {
    it('loads the application and hydrates the form, including its status', () => {
      api.getById.mockReturnValue(
        of(makeApplication({ id: 'app-1', status: 'SUBMITTED', legalBusinessName: 'Summit Coffee Roasters' })),
      );
      const fixture = createComponent('app-1');
      const component = fixture.componentInstance;

      expect(api.getById).toHaveBeenCalledWith('app-1');
      expect((component as any).applicationStatus()).toBe('SUBMITTED');
      expect((component as any).form.controls.businessInfo.controls.legalBusinessName.value).toBe(
        'Summit Coffee Roasters',
      );
    });

    it('sets loadError when the application cannot be fetched', () => {
      api.getById.mockReturnValue(throwError(() => new Error('not found')));
      const fixture = createComponent('missing-id');
      const component = fixture.componentInstance;

      expect((component as any).loadError()).toBe(true);
    });

    it('prefers a newer local draft over the server value on hydrate', () => {
      localStorage.setItem(
        'merchant-portal.draft.app-1',
        JSON.stringify({
          value: { businessInfo: { legalBusinessName: 'Locally Edited Name' } },
          savedAt: new Date('2026-06-01T00:00:00.000Z').getTime(),
        }),
      );
      api.getById.mockReturnValue(
        of(
          makeApplication({
            id: 'app-1',
            legalBusinessName: 'Server Name',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        ),
      );

      const fixture = createComponent('app-1');
      const component = fixture.componentInstance;

      expect((component as any).form.controls.businessInfo.controls.legalBusinessName.value).toBe(
        'Locally Edited Name',
      );
    });
  });

  describe('autosave', () => {
    it('debounces form changes, sends only the flattened non-empty fields, and reports saved', async () => {
      const fixture = createComponent('app-1');
      const component = fixture.componentInstance;
      api.update.mockClear();

      (component as any).form.controls.businessInfo.patchValue({ legalBusinessName: 'Updated Name' });
      await vi.advanceTimersByTimeAsync(850);

      expect(api.update).toHaveBeenCalledTimes(1);
      const [, patch] = api.update.mock.calls[0];
      expect(patch.legalBusinessName).toBe('Updated Name');
      expect(patch).not.toHaveProperty('website');
      expect((component as any).saveStatus()).toBe('saved');
    });

    it('reports an error status when the save fails, without throwing', async () => {
      api.update.mockReturnValue(throwError(() => new Error('network down')));
      const fixture = createComponent('app-1');
      const component = fixture.componentInstance;

      (component as any).form.controls.businessInfo.patchValue({ legalBusinessName: 'Updated Name' });
      await vi.advanceTimersByTimeAsync(850);

      expect((component as any).saveStatus()).toBe('error');
    });
  });

  describe('submit', () => {
    it('marks the form touched and does not submit when invalid', () => {
      const fixture = createComponent('app-1');
      const component = fixture.componentInstance;

      (component as any).submit();

      expect(api.submit).not.toHaveBeenCalled();
      expect((component as any).form.controls.businessInfo.controls.legalBusinessName.touched).toBe(true);
    });

    it('submits, clears the local draft, and navigates to the detail page when valid', () => {
      const fixture = createComponent('app-1');
      const component = fixture.componentInstance;
      localStorage.setItem('merchant-portal.draft.app-1', JSON.stringify({ value: {}, savedAt: Date.now() }));

      (component as any).form.patchValue({
        businessInfo: {
          legalBusinessName: 'Summit Coffee Roasters',
          businessType: 'LLC',
          registrationNumber: '12-3456789',
        },
        ownerInfo: {
          ownerFullName: 'Sam Sales',
          ownerEmail: 'sales@merchantportal.test',
          ownerPhone: '555-123-4567',
          ownerNid: '222-222-2222',
        },
        banking: {
          bankName: 'First National Bank',
          bankBranch: 'Downtown Branch',
          bankAccountNumber: '1234567890',
        },
        processingEstimate: { estimatedMonthlyVolume: 50_000, averageTransactionSize: 75 },
      });

      (component as any).submit();

      expect(api.submit).toHaveBeenCalledWith('app-1');
      expect(localStorage.getItem('merchant-portal.draft.app-1')).toBeNull();
      expect(navigateSpy).toHaveBeenCalledWith(['/applications', 'app-1']);
    });
  });
});
