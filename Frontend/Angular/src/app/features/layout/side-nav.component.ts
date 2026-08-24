import { Component, Input, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MenuItem } from '../../core/models/menu-item.model';

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatListModule, MatButtonModule, MatExpansionModule, MatProgressSpinnerModule],
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.scss'],
})
export class SideNavComponent {
  @Input() items: MenuItem[] = [];
  @Input() loading = false;

  private readonly router = inject(Router);

  isItemActive(route: string): boolean {
    return this.router.isActive(route, false);
  }

  isGroupActive(item: MenuItem): boolean {
    if (this.isItemActive(item.route)) {
      return true;
    }

    return (item.children ?? []).some((child) => this.isItemActive(child.route));
  }
}
