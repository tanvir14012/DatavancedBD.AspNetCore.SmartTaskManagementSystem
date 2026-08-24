import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { UserListItem, UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage implements OnInit {
  readonly users = signal<UserListItem[]>([]);
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly totalCount = signal(0);
  readonly totalPages = signal(1);
  readonly search = signal('');
  readonly sortColumn = signal('CreatedAt');
  readonly sortDirection = signal('desc');
  readonly roleFilter = signal('all');
  readonly statusFilter = signal('all');
  readonly isAdmin = signal(false);
  readonly showForm = signal(false);
  readonly editingUserId = signal<number | null>(null);
  readonly isLoading = signal(false);

  readonly form = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'Team Member',
  };

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();

  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.isAdmin.set(this.authService.currentUser()?.role === 'Admin');
    this.searchSubject
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.loadUsers();
      });

    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading.set(true);

    this.userService
      .list({
        start: (this.page() - 1) * this.pageSize,
        length: this.pageSize,
        search: this.search().trim() || undefined,
        sortColumn: this.sortColumn(),
        sortDirection: this.sortDirection(),
        role: this.roleFilter(),
        status: this.statusFilter(),
      })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (result) => {
          this.users.set(result.items);
          this.totalCount.set(result.totalCount);
          this.totalPages.set(result.totalPages || 1);
          this.page.set(Math.min(this.page(), this.totalPages() || 1));
        },
        error: () => {
          this.users.set([]);
          this.totalCount.set(0);
          this.totalPages.set(1);
        },
      });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.search().trim());
  }

  onSearch(): void {
    this.searchSubject.next(this.search().trim());
  }

  onFilterChange(): void {
    this.page.set(1);
    this.loadUsers();
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

  submitForm(): void {
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
    const request$ = editingId === null
      ? this.userService.create(payload)
      : this.userService.update(editingId, payload);

    request$.subscribe(() => {
      this.showForm.set(false);
      this.loadUsers();
    });
  }

  deleteUser(id: number): void {
    if (!this.isAdmin()) {
      return;
    }

    if (!window.confirm('Delete this user?')) {
      return;
    }

    this.userService.delete(id).subscribe(() => {
      this.loadUsers();
    });
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadUsers();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update(p => p + 1);
      this.loadUsers();
    }
  }
}
