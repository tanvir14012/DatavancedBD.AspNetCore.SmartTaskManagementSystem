import { CommonModule } from '@angular/common';
import { httpResource, HttpResourceRequest } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { UserListItem, UserListParams, UserListResult, UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);

  readonly page = signal(1);
  readonly pageSize = 10;
  readonly rawSearch = signal('');

  // Debounces typing before triggering query updates.
  readonly search = toSignal(toObservable(this.rawSearch).pipe(debounceTime(300), distinctUntilChanged()), {
    initialValue: '',
  });

  readonly sortColumn = signal('CreatedAt');
  readonly sortDirection = signal('desc');
  readonly roleFilter = signal('all');
  readonly statusFilter = signal('all');
  readonly isAdmin = computed(() => this.authService.currentUser()?.role === 'Admin');
  readonly showForm = signal(false);
  readonly editingUserId = signal<number | null>(null);

  readonly form = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'Team Member',
  };

  readonly queryParams = computed<UserListParams>(() => ({
    start: (this.page() - 1) * this.pageSize,
    length: this.pageSize,
    search: this.search().trim() || undefined,
    sortColumn: this.sortColumn(),
    sortDirection: this.sortDirection(),
    role: this.roleFilter() === 'all' ? undefined : this.roleFilter(),
    status: this.statusFilter() === 'all' ? undefined : this.statusFilter(),
  }));

  readonly usersResource = httpResource<UserListResult>(() => {
    const params = this.queryParams();
    const requestParams: Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>> = {
      start: params.start ?? 0,
      length: params.length ?? this.pageSize,
      ...(params.search ? { search: params.search } : {}),
      ...(params.sortColumn ? { sortColumn: params.sortColumn } : {}),
      ...(params.sortDirection ? { sortDirection: params.sortDirection } : {}),
      ...(params.role ? { role: params.role } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const request: HttpResourceRequest = {
      url: `${environment.apiBaseUrl}/users`,
      params: requestParams,
      withCredentials: true,
    };

    return request;
  });

  readonly users = computed(() => this.usersResource.value()?.items ?? []);
  readonly totalCount = computed(() => this.usersResource.value()?.totalCount ?? 0);
  readonly totalPages = computed(() => Math.max(1, this.usersResource.value()?.totalPages ?? 1));
  readonly isLoading = this.usersResource.isLoading;

  constructor() {
    effect(() => {
      this.search();
      this.roleFilter();
      this.statusFilter();
      this.sortColumn();
      this.sortDirection();

      untracked(() => {
        this.page.set(1);
      });
    });
  }

  openCreateForm(): void {
    this.editingUserId.set(null);
    this.form.firstName = '';
    this.form.lastName = '';
    this.form.email = '';
    this.form.password = '';
    this.form.role = 'Team Member';
    this.showForm.set(true);
  }

  openEditForm(user: UserListItem): void {
    this.editingUserId.set(user.id);
    this.form.firstName = user.firstName;
    this.form.lastName = user.lastName;
    this.form.email = user.email;
    this.form.password = '';
    this.form.role = user.role;
    this.showForm.set(true);
  }

  async submitForm(): Promise<void> {
    const currentForm = this.form;
    if (!currentForm.firstName.trim() || !currentForm.lastName.trim() || !currentForm.email.trim()) {
      return;
    }

    const payload = {
      firstName: currentForm.firstName.trim(),
      lastName: currentForm.lastName.trim(),
      email: currentForm.email.trim(),
      role: currentForm.role,
      ...(this.editingUserId() === null ? { password: currentForm.password || 'Datavanced@123' } : {}),
    };

    const editingId = this.editingUserId();
    const request$ = editingId === null ? this.userService.create(payload) : this.userService.update(editingId, payload);

    try {
      await firstValueFrom(request$);
      this.showForm.set(false);
      this.usersResource.reload();
    } catch {
      // The mutation error is handled by the surrounding request flow. Keep the form open so the user can retry.
    }
  }

  async deleteUser(id: number): Promise<void> {
    if (!this.isAdmin()) {
      return;
    }

    if (!window.confirm('Delete this user?')) {
      return;
    }

    try {
      await firstValueFrom(this.userService.delete(id));
      this.usersResource.reload();
    } catch {
      // Avoid breaking the list view when a delete fails. The HTTP layer can surface the error elsewhere.
    }
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((currentPage) => currentPage - 1);
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((currentPage) => currentPage + 1);
    }
  }
}
