import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';
import { TopNavComponent } from './top-nav.component';
import { SideNavComponent } from './side-nav.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [TopNavComponent, SideNavComponent, RouterOutlet],
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.scss']
})
export class AppShellComponent implements OnInit {
  readonly menuService = inject(MenuService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        this.menuService.setCurrentRoute(event.urlAfterRedirects || this.router.url);
      });
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.menuService.setCurrentRoute(this.router.url);
      this.menuService.loadMenus().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
  }
}
