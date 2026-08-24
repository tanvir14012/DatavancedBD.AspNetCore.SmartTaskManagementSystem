import { Component, Input, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { take } from 'rxjs';
import { MenuItem, UserProfile } from '../../core/models/menu-item.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatToolbarModule, MatButtonModule, MatMenuModule, MatDividerModule],
  templateUrl: './top-nav.component.html',
  styleUrls: ['./top-nav.component.scss'],
})
export class TopNavComponent {
  @Input() menus: MenuItem[] = [];
  @Input() user: UserProfile | null = null;

  readonly userMenuOpen = signal(false);

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  getItemRoute(item: MenuItem): string {
    return item.children?.[0]?.route ?? item.route;
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
  }

  logout(): void {
    this.userMenuOpen.set(false);
    this.authService
      .logout()
      .pipe(take(1))
      .subscribe({
        next: () => this.router.navigateByUrl('/homepage'),
        error: () => this.router.navigateByUrl('/homepage'),
      });
  }
}
