import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { Role } from '../../core/auth/role';
import { Realtime } from '../../core/realtime/realtime';
import { Shell } from './shell';

describe('Shell', () => {
  let component: Shell;
  let fixture: ComponentFixture<Shell>;
  let auth: { currentUser: ReturnType<typeof vi.fn>; role: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn> };
  let realtime: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = {
      currentUser: vi.fn().mockReturnValue({ id: 'u-1', name: 'Riya Reviewer', email: 'r@x.test', role: Role.Reviewer }),
      role: vi.fn().mockReturnValue(Role.Reviewer),
      logout: vi.fn(),
    };
    realtime = { connect: vi.fn(), disconnect: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: auth },
        { provide: Realtime, useValue: realtime },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Shell);
    component = fixture.componentInstance;
  });

  it('should create and connect to realtime updates on init', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(realtime.connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects realtime when the component is destroyed', () => {
    fixture.detectChanges();
    fixture.destroy();
    expect(realtime.disconnect).toHaveBeenCalledTimes(1);
  });

  it('toggleMenu opens a menu and toggling the same one again closes it', () => {
    expect((component as any).openMenu()).toBeNull();

    (component as any).toggleMenu('user');
    expect((component as any).openMenu()).toBe('user');

    (component as any).toggleMenu('user');
    expect((component as any).openMenu()).toBeNull();
  });

  it('toggleMenu switches directly from one menu to another', () => {
    (component as any).toggleMenu('mobile-nav');
    expect((component as any).openMenu()).toBe('mobile-nav');

    (component as any).toggleMenu('user');
    expect((component as any).openMenu()).toBe('user');
  });

  it('logout closes the menu, disconnects realtime, logs out, and navigates to /login', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    (component as any).toggleMenu('user');

    (component as any).logout();

    expect((component as any).openMenu()).toBeNull();
    expect(realtime.disconnect).toHaveBeenCalledTimes(1);
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });
});
