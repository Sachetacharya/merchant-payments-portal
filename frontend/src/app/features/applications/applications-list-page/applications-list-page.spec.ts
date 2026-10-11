import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Auth } from '../../../core/auth/auth';
import { Role } from '../../../core/auth/role';
import { ApplicationsApi } from '../../../core/applications/applications-api';
import { Application } from '../../../core/applications/application.model';
import { Realtime, StatusChangedEvent } from '../../../core/realtime/realtime';
import { ApplicationsListPage } from './applications-list-page';

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

describe('ApplicationsListPage', () => {
  let component: ApplicationsListPage;
  let fixture: ComponentFixture<ApplicationsListPage>;
  let api: { list: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let role: WritableSignal<Role | null>;
  let statusChanged: WritableSignal<StatusChangedEvent | null>;

  beforeEach(async () => {
    role = signal<Role | null>(Role.Sales);
    statusChanged = signal<StatusChangedEvent | null>(null);
    api = {
      list: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 10 })),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [ApplicationsListPage],
      providers: [
        provideRouter([]),
        { provide: ApplicationsApi, useValue: api },
        { provide: Auth, useValue: { role } },
        { provide: Realtime, useValue: { statusChanged } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationsListPage);
    component = fixture.componentInstance;
    vi.useFakeTimers();
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('canEdit / canDelete', () => {
    it('is true for SALES on a DRAFT or SUBMITTED application', () => {
      role.set(Role.Sales);
      expect((component as any).canEdit(makeApplication({ status: 'DRAFT' }))).toBe(true);
      expect((component as any).canEdit(makeApplication({ status: 'SUBMITTED' }))).toBe(true);
      expect((component as any).canDelete(makeApplication({ status: 'DRAFT' }))).toBe(true);
    });

    it('is false for SALES once a reviewer has picked it up (UNDER_REVIEW+)', () => {
      role.set(Role.Sales);
      expect((component as any).canEdit(makeApplication({ status: 'UNDER_REVIEW' }))).toBe(false);
      expect((component as any).canEdit(makeApplication({ status: 'APPROVED' }))).toBe(false);
    });

    it('is always false for REVIEWER and ADMIN regardless of status', () => {
      role.set(Role.Reviewer);
      expect((component as any).canEdit(makeApplication({ status: 'DRAFT' }))).toBe(false);
      role.set(Role.Admin);
      expect((component as any).canEdit(makeApplication({ status: 'DRAFT' }))).toBe(false);
    });
  });

  it('statusChipClass formats the CSS class from the status', () => {
    expect((component as any).statusChipClass('UNDER_REVIEW')).toBe('status-chip status-under_review');
    expect((component as any).statusChipClass('APPROVED')).toBe('status-chip status-approved');
  });

  it('onStatusChange sets the filter and resets to the first page', () => {
    (component as any).page.set(3);
    (component as any).onStatusChange('APPROVED');

    expect((component as any).statusFilter()).toBe('APPROVED');
    expect((component as any).page()).toBe(0);
  });

  it('onSearchChange sets the term and resets to the first page', () => {
    (component as any).page.set(2);
    (component as any).onSearchChange('coffee');

    expect((component as any).searchTerm()).toBe('coffee');
    expect((component as any).page()).toBe(0);
  });

  describe('the data pipeline', () => {
    it('loads successfully and passes page/pageSize/status/search through to the API (1-indexed page)', async () => {
      const items = [makeApplication()];
      api.list.mockReturnValue(of({ items, total: 1, page: 1, pageSize: 10 }));

      (component as any).onStatusChange('DRAFT');
      await vi.advanceTimersByTimeAsync(350);

      expect(api.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 10, status: 'DRAFT' }),
      );
      expect((component as any).state()).toEqual({ status: 'success', items, total: 1 });
    });

    it('debounces search input before calling the API', async () => {
      api.list.mockClear();
      (component as any).onSearchChange('s');
      (component as any).onSearchChange('su');
      (component as any).onSearchChange('summit');

      await vi.advanceTimersByTimeAsync(100);
      expect(api.list).not.toHaveBeenCalledWith(expect.objectContaining({ search: 'summit' }));

      await vi.advanceTimersByTimeAsync(250);
      expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ search: 'summit' }));
    });

    it('surfaces an error state when the API call fails, then recovers on retry()', async () => {
      api.list.mockReturnValueOnce(throwError(() => new Error('network down')));
      await vi.advanceTimersByTimeAsync(350);
      expect((component as any).state()).toEqual({ status: 'error' });

      api.list.mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 10 }));
      (component as any).retry();
      await vi.advanceTimersByTimeAsync(350);

      expect((component as any).state()).toEqual({ status: 'success', items: [], total: 0 });
    });

    it('refetches automatically when a realtime status-change event arrives', async () => {
      await vi.advanceTimersByTimeAsync(350);
      api.list.mockClear();

      statusChanged.set({ id: 'app-1', status: 'APPROVED' });
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(350);

      expect(api.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('navigation', () => {
    it('openApplication routes to the edit wizard for an editable application, detail otherwise', () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      role.set(Role.Sales);

      (component as any).openApplication(makeApplication({ id: 'app-1', status: 'DRAFT' }));
      expect(navigateSpy).toHaveBeenCalledWith(['/applications', 'app-1', 'edit']);

      (component as any).openApplication(makeApplication({ id: 'app-2', status: 'UNDER_REVIEW' }));
      expect(navigateSpy).toHaveBeenCalledWith(['/applications', 'app-2']);
    });
  });

  describe('seeding statusFilter from the ?status= query param', () => {
    it('picks up a valid status so a dashboard link like /applications?status=SUBMITTED lands pre-filtered', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ApplicationsListPage],
        providers: [
          provideRouter([]),
          { provide: ApplicationsApi, useValue: api },
          { provide: Auth, useValue: { role } },
          { provide: Realtime, useValue: { statusChanged } },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { queryParamMap: convertToParamMap({ status: 'SUBMITTED' }) } },
          },
        ],
      }).compileComponents();

      const queryParamFixture = TestBed.createComponent(ApplicationsListPage);
      expect((queryParamFixture.componentInstance as any).statusFilter()).toBe('SUBMITTED');
    });

    it('ignores an invalid/unknown status value and falls back to no filter', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ApplicationsListPage],
        providers: [
          provideRouter([]),
          { provide: ApplicationsApi, useValue: api },
          { provide: Auth, useValue: { role } },
          { provide: Realtime, useValue: { statusChanged } },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { queryParamMap: convertToParamMap({ status: 'not-a-real-status' }) } },
          },
        ],
      }).compileComponents();

      const queryParamFixture = TestBed.createComponent(ApplicationsListPage);
      expect((queryParamFixture.componentInstance as any).statusFilter()).toBeNull();
    });
  });

  describe('deleteApplication', () => {
    let confirmSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      confirmSpy = vi.spyOn(window, 'confirm');
    });

    it('does nothing if the user cancels the confirmation', () => {
      confirmSpy.mockReturnValue(false);
      const event = new Event('click');

      (component as any).deleteApplication(event, makeApplication());

      expect(api.delete).not.toHaveBeenCalled();
    });

    it('calls the API and retries the list on confirmed delete', async () => {
      confirmSpy.mockReturnValue(true);
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      await vi.advanceTimersByTimeAsync(350);
      api.list.mockClear();

      (component as any).deleteApplication(event, makeApplication({ id: 'app-9' }));

      expect((event as any).stopPropagation).toHaveBeenCalled();
      expect(api.delete).toHaveBeenCalledWith('app-9');
      expect((component as any).deletingId()).toBeNull();

      await vi.advanceTimersByTimeAsync(350);
      expect(api.list).toHaveBeenCalledTimes(1);
    });
  });
});
