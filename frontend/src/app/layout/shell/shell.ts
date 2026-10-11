import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterOutlet, Router } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { Role } from '../../core/auth/role';
import { Realtime } from '../../core/realtime/realtime';

type OpenMenu = 'mobile-nav' | 'user' | null;

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class Shell implements OnInit {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly realtime = inject(Realtime);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly Role = Role;
  protected readonly currentUser = this.auth.currentUser;
  protected readonly role = this.auth.role;
  protected readonly openMenu = signal<OpenMenu>(null);

  private readonly mobileNavTrigger = viewChild<ElementRef<HTMLButtonElement>>('mobileNavTrigger');
  private readonly userMenuTrigger = viewChild<ElementRef<HTMLButtonElement>>('userMenuTrigger');

  ngOnInit(): void {
    this.realtime.connect();
    this.destroyRef.onDestroy(() => this.realtime.disconnect());
  }

  protected toggleMenu(menu: OpenMenu): void {
    this.openMenu.update((current) => (current === menu ? null : menu));
  }

  protected closeMenu(): void {
    this.openMenu.set(null);
  }

  protected closeMenuOnEscape(): void {
    const menu = this.openMenu();
    this.openMenu.set(null);
    if (menu === 'mobile-nav') {
      this.mobileNavTrigger()?.nativeElement.focus();
    } else if (menu === 'user') {
      this.userMenuTrigger()?.nativeElement.focus();
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.openMenu() && !target.closest('.menu-popover, .menu-trigger')) {
      this.closeMenu();
    }
  }

  protected logout(): void {
    this.closeMenu();
    this.realtime.disconnect();
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
