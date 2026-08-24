import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
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
})
export class UsersPage implements OnInit {
  users: UserListItem[] = [];
  page = 1;
  pageSize = 10;
  totalCount = 0;
  totalPages = 1;
  search = '';
  sortColumn = 'CreatedAt';
  sortDirection = 'desc';
  roleFilter = 'all';
  statusFilter = 'all';
  isAdmin = false;
  showForm = false;
  editingUserId: number | null = null;
  isLoading = false;

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();

  form = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'Team Member',
  };

  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.currentUser()?.role === 'Admin';
    this.searchSubject
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page = 1;
        this.loadUsers();
      });

    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;

    this.userService
      .list({
        start: (this.page - 1) * this.pageSize,
        length: this.pageSize,
        search: this.search.trim() || undefined,
        sortColumn: this.sortColumn,
        sortDirection: this.sortDirection,
        role: this.roleFilter,
        status: this.statusFilter,
      })
      .pipe(
        finalize(() => (this.isLoading = false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          this.users = result.items;
          this.totalCount = result.totalCount;
          this.totalPages = result.totalPages || 1;
          this.page = Math.min(this.page, this.totalPages || 1);
        },
        error: () => {
          this.users = [];
          this.totalCount = 0;
          this.totalPages = 1;
        },
      });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.search.trim());
  }

  onSearch(): void {
    this.searchSubject.next(this.search.trim());
  }

  onFilterChange(): void {
    this.page = 1;
    this.loadUsers();
  }

  openCreateForm(): void {
    this.editingUserId = null;
    this.form = {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'Team Member',
    };
    this.showForm = true;
  }

  openEditForm(user: UserListItem): void {
    this.editingUserId = user.id;
    this.form = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      role: user.role,
    };
    this.showForm = true;
  }

  submitForm(): void {
    if (!this.form.firstName.trim() || !this.form.lastName.trim() || !this.form.email.trim()) {
      return;
    }

    const payload = {
      firstName: this.form.firstName.trim(),
      lastName: this.form.lastName.trim(),
      email: this.form.email.trim(),
      role: this.form.role,
      ...(this.editingUserId === null ? { password: this.form.password || 'Datavanced@123' } : {}),
    };

    const request$ = this.editingUserId === null
      ? this.userService.create(payload)
      : this.userService.update(this.editingUserId, payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.showForm = false;
      this.loadUsers();
    });
  }

  deleteUser(id: number): void {
    if (!this.isAdmin) {
      return;
    }

    if (!window.confirm('Delete this user?')) {
      return;
    }

    this.userService.delete(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loadUsers();
    });
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page -= 1;
      this.loadUsers();
    }
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page += 1;
      this.loadUsers();
    }
  }
}
