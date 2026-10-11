import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Auth } from '../../../core/auth/auth';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let auth: { login: ReturnType<typeof vi.fn> };
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    auth = { login: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), { provide: Auth, useValue: auth }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts with an invalid form', () => {
    expect((component as any).form.invalid).toBe(true);
  });

  it('rejects an invalid email and a too-short password', () => {
    const form = (component as any).form;
    form.controls.email.setValue('not-an-email');
    form.controls.password.setValue('short');

    expect(form.controls.email.invalid).toBe(true);
    expect(form.controls.password.invalid).toBe(true);
  });

  it('becomes valid with a real email and an 8+ character password', () => {
    const form = (component as any).form;
    form.controls.email.setValue('reviewer@merchantportal.test');
    form.controls.password.setValue('Password123!');

    expect(form.valid).toBe(true);
  });

  it('does not call Auth.login when the form is invalid', () => {
    (component as any).submit();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('calls Auth.login with the form values when valid', () => {
    auth.login.mockReturnValue(of({}));
    const form = (component as any).form;
    form.controls.email.setValue('reviewer@merchantportal.test');
    form.controls.password.setValue('Password123!');

    (component as any).submit();

    expect(auth.login).toHaveBeenCalledWith('reviewer@merchantportal.test', 'Password123!');
    expect(navigateSpy).toHaveBeenCalledWith('/dashboard');
  });
});
