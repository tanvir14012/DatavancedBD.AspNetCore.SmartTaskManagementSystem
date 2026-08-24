import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
    this.loadUsers();
  }

  loadUsers(): void {
    this.userService
      .list({
        start: (this.page - 1) * this.pageSize,
        length: this.pageSize,
        search: this.search,
        sortColumn: this.sortColumn,
        sortDirection: this.sortDirection,
        role: this.roleFilter,
        status: this.statusFilter,
      })
      .subscribe((result) => {
        this.users = result.items;
        this.totalCount = result.totalCount;
        this.totalPages = result.totalPages || 1;
        this.page = Math.min(this.page, this.totalPages || 1);
      });
  }

  onSearch(): void {
    this.page = 1;
    this.loadUsers();
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

    request$.subscribe(() => {
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

    this.userService.delete(id).subscribe(() => {
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
