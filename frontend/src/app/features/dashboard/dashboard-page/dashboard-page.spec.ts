import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Auth } from '../../../core/auth/auth';
import { Role } from '../../../core/auth/role';
import { ApplicationsApi } from '../../../core/applications/applications-api';
import { Realtime, StatusChangedEvent } from '../../../core/realtime/realtime';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  let component: DashboardPage;
  let fixture: ComponentFixture<DashboardPage>;
  let api: { statusCounts: ReturnType<typeof vi.fn> };
  let statusChanged: WritableSignal<StatusChangedEvent | null>;
  let role: WritableSignal<Role | null>;

  const counts = { DRAFT: 2, SUBMITTED: 1, UNDER_REVIEW: 13, APPROVED: 4, REJECTED: 0 };

  function createComponent(): ComponentFixture<DashboardPage> {
    const f = TestBed.createComponent(DashboardPage);
    f.detectChanges();
    return f;
  }

  beforeEach(async () => {
    api = { statusCounts: vi.fn().mockReturnValue(of(counts)) };
    statusChanged = signal<StatusChangedEvent | null>(null);
    role = signal<Role | null>(Role.Sales);

    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        { provide: ApplicationsApi, useValue: api },
        { provide: Auth, useValue: { role } },
        { provide: Realtime, useValue: { statusChanged } },
      ],
    }).compileComponents();

    fixture = createComponent();
    component = fixture.componentInstance;
  });

  it('should create and load the status counts on init', () => {
    expect(component).toBeTruthy();
    expect(api.statusCounts).toHaveBeenCalledTimes(1);
    expect((component as any).statusCounts()).toEqual(counts);
  });

  it('derives per-status cards and the total from the counts', () => {
    expect((component as any).total()).toBe(20);
    expect((component as any).cards()).toEqual([
      { status: 'DRAFT', label: 'Draft', count: 2 },
      { status: 'SUBMITTED', label: 'Submitted', count: 1 },
      { status: 'UNDER_REVIEW', label: 'Under review', count: 13 },
      { status: 'APPROVED', label: 'Approved', count: 4 },
      { status: 'REJECTED', label: 'Rejected', count: 0 },
    ]);
  });

  it('refreshes the counts again when a realtime status-change event arrives', () => {
    expect(api.statusCounts).toHaveBeenCalledTimes(1);

    statusChanged.set({ id: 'app-1', status: 'APPROVED' });
    fixture.detectChanges();

    expect(api.statusCounts).toHaveBeenCalledTimes(2);
  });

  describe('quickInfo', () => {
    it('points SALES at their own unsubmitted drafts', () => {
      role.set(Role.Sales);
      expect((component as any).quickInfo()).toEqual({ status: 'DRAFT', message: '2 drafts not yet submitted' });
    });

    it('points REVIEWER at what is assigned to them under review', () => {
      role.set(Role.Reviewer);
      expect((component as any).quickInfo()).toEqual({
        status: 'UNDER_REVIEW',
        message: '13 assigned to you under review',
      });
    });

    it('points ADMIN at submitted applications awaiting assignment', () => {
      role.set(Role.Admin);
      expect((component as any).quickInfo()).toEqual({
        status: 'SUBMITTED',
        message: '1 submitted application awaiting assignment',
      });
    });

    it('pluralizes correctly for a count of exactly one vs. anything else', () => {
      role.set(Role.Sales);
      api.statusCounts.mockReturnValue(of({ ...counts, DRAFT: 1 }));
      const f = createComponent();
      expect((f.componentInstance as any).quickInfo()).toEqual({
        status: 'DRAFT',
        message: '1 draft not yet submitted',
      });
    });
  });
});
