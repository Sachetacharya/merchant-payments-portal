import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Auth } from '../../../core/auth/auth';
import { Role } from '../../../core/auth/role';
import { ApplicationsApi } from '../../../core/applications/applications-api';
import { Application } from '../../../core/applications/application.model';
import { Realtime, StatusChangedEvent } from '../../../core/realtime/realtime';
import { ApplicationDetailPage } from './application-detail-page';

function makeApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: 'app-1',
    status: 'UNDER_REVIEW',
    ownerId: 'u-sales-1',
    ownerName: 'Sam Sales',
    assignedReviewerId: 'u-reviewer-1',
    assignedReviewerName: 'Riya Reviewer',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    riskHistory: [],
    ...overrides,
  };
}

describe('ApplicationDetailPage', () => {
  let api: {
    getById: ReturnType<typeof vi.fn>;
    listReviewers: ReturnType<typeof vi.fn>;
    reveal: ReturnType<typeof vi.fn>;
    recordDecision: ReturnType<typeof vi.fn>;
    assign: ReturnType<typeof vi.fn>;
  };
  let role: WritableSignal<Role | null>;
  let statusChanged: WritableSignal<StatusChangedEvent | null>;

  function createComponent(): ComponentFixture<ApplicationDetailPage> {
    const fixture = TestBed.createComponent(ApplicationDetailPage);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    role = signal<Role | null>(Role.Reviewer);
    statusChanged = signal<StatusChangedEvent | null>(null);
    api = {
      getById: vi.fn().mockReturnValue(of(makeApplication())),
      listReviewers: vi.fn().mockReturnValue(of([{ id: 'u-reviewer-1', name: 'Riya Reviewer' }])),
      reveal: vi.fn().mockReturnValue(of({ field: 'registrationNumber', value: '12-3456789' })),
      recordDecision: vi.fn().mockReturnValue(of(makeApplication({ status: 'APPROVED' }))),
      assign: vi.fn().mockReturnValue(of(makeApplication({ status: 'UNDER_REVIEW' }))),
    };

    TestBed.configureTestingModule({
      imports: [ApplicationDetailPage],
      providers: [
        { provide: ApplicationsApi, useValue: api },
        { provide: Auth, useValue: { role } },
        { provide: Realtime, useValue: { statusChanged } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'app-1' }) } } },
      ],
    });
  });

  it('loads the application on init', () => {
    const component = createComponent().componentInstance as any;

    expect(api.getById).toHaveBeenCalledWith('app-1');
    expect(component.state()).toEqual({ status: 'success', application: makeApplication() });
  });

  it('sets an error state when the load fails', () => {
    api.getById.mockReturnValue(throwError(() => new Error('not found')));
    const component = createComponent().componentInstance as any;
    expect(component.state()).toEqual({ status: 'error' });
  });

  it('only fetches the reviewer list for ADMIN', () => {
    role.set(Role.Admin);
    createComponent();
    expect(api.listReviewers).toHaveBeenCalledTimes(1);
  });

  it('does not fetch the reviewer list for non-admin roles', () => {
    role.set(Role.Reviewer);
    createComponent();
    expect(api.listReviewers).not.toHaveBeenCalled();
  });

  describe('role/status gated actions', () => {
    it('canReveal is true for REVIEWER', () => {
      role.set(Role.Reviewer);
      expect((createComponent().componentInstance as any).canReveal()).toBe(true);
    });

    it('canReveal is true for ADMIN', () => {
      role.set(Role.Admin);
      expect((createComponent().componentInstance as any).canReveal()).toBe(true);
    });

    it('canReveal is false for SALES', () => {
      role.set(Role.Sales);
      expect((createComponent().componentInstance as any).canReveal()).toBe(false);
    });

    it('canDecide requires reveal permission AND status UNDER_REVIEW', () => {
      role.set(Role.Reviewer);
      const component = createComponent().componentInstance as any;
      expect(component.canDecide(makeApplication({ status: 'UNDER_REVIEW' }))).toBe(true);
      expect(component.canDecide(makeApplication({ status: 'SUBMITTED' }))).toBe(false);
    });

    it('canAssign is true only for ADMIN on a SUBMITTED application', () => {
      role.set(Role.Admin);
      const component = createComponent().componentInstance as any;
      expect(component.canAssign(makeApplication({ status: 'SUBMITTED' }))).toBe(true);
      expect(component.canAssign(makeApplication({ status: 'UNDER_REVIEW' }))).toBe(false);
    });

    it('canAssign is false for REVIEWER even on a SUBMITTED application', () => {
      role.set(Role.Reviewer);
      const component = createComponent().componentInstance as any;
      expect(component.canAssign(makeApplication({ status: 'SUBMITTED' }))).toBe(false);
    });
  });

  describe('onReveal', () => {
    it('calls the API once and caches the result; a second call for the same field is a no-op', () => {
      const component = createComponent().componentInstance as any;

      component.onReveal('app-1', 'registrationNumber');
      expect(api.reveal).toHaveBeenCalledWith('app-1', 'registrationNumber');
      expect(component.revealedValues()['registrationNumber']).toBe('12-3456789');

      api.reveal.mockClear();
      component.onReveal('app-1', 'registrationNumber');
      expect(api.reveal).not.toHaveBeenCalled();
    });
  });

  describe('decide', () => {
    it('does not call the API when the notes field is invalid', () => {
      const component = createComponent().componentInstance as any;
      component.decide('app-1', true);

      expect(api.recordDecision).not.toHaveBeenCalled();
      expect(component.decisionForm.controls.notes.touched).toBe(true);
    });

    it('records the decision and refreshes state when valid', () => {
      const component = createComponent().componentInstance as any;
      component.decisionForm.controls.notes.setValue('Meets underwriting criteria.');

      component.decide('app-1', true);

      expect(api.recordDecision).toHaveBeenCalledWith('app-1', true, 'Meets underwriting criteria.');
      expect(component.state()).toEqual({ status: 'success', application: makeApplication({ status: 'APPROVED' }) });
      expect(component.decisionForm.controls.notes.value).toBe('');
    });
  });

  describe('assign', () => {
    it('does not call the API when no reviewer is selected', () => {
      const component = createComponent().componentInstance as any;
      component.assign('app-1');
      expect(api.assign).not.toHaveBeenCalled();
    });

    it('assigns the selected reviewer and refreshes state when valid', () => {
      const component = createComponent().componentInstance as any;
      component.assignForm.controls.reviewerId.setValue('u-reviewer-2');

      component.assign('app-1');

      expect(api.assign).toHaveBeenCalledWith('app-1', 'u-reviewer-2');
      expect(component.state().status).toBe('success');
    });
  });

  describe('realtime self-echo deduplication', () => {
    it('does NOT reload when the broadcast status already matches local state (an echo of our own action)', () => {
      const fixture = createComponent();
      api.getById.mockClear();

      statusChanged.set({ id: 'app-1', status: 'UNDER_REVIEW' });
      fixture.detectChanges();

      expect(api.getById).not.toHaveBeenCalled();
    });

    it('DOES reload when the broadcast reveals a genuinely different status', () => {
      const fixture = createComponent();
      api.getById.mockReturnValue(of(makeApplication({ status: 'APPROVED' })));
      api.getById.mockClear();

      statusChanged.set({ id: 'app-1', status: 'APPROVED' });
      fixture.detectChanges();

      expect(api.getById).toHaveBeenCalledTimes(1);
      expect((fixture.componentInstance as any).state()).toEqual({
        status: 'success',
        application: makeApplication({ status: 'APPROVED' }),
      });
    });

    it('ignores broadcasts for a different application id', () => {
      const fixture = createComponent();
      api.getById.mockClear();

      statusChanged.set({ id: 'some-other-app', status: 'APPROVED' });
      fixture.detectChanges();

      expect(api.getById).not.toHaveBeenCalled();
    });
  });
});
