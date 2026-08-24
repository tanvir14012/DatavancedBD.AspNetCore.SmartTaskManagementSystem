import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="login-shell">
      <div class="login-card">
        <div class="brand-block">
          <span class="eyebrow">Smart Task Management System</span>
          <h1>Welcome back</h1>
          <p>Sign in to manage projects, tasks, teams, and priorities.</p>
        </div>

        <form (ngSubmit)="submit()" class="login-form">
          <label>
            <span>Email</span>
            <input [(ngModel)]="email" name="email" type="email" placeholder="name@company.com" />
          </label>

          <label>
            <span>Password</span>
            <input [(ngModel)]="password" name="password" type="password" placeholder="••••••••" />
          </label>

          <button type="submit" [disabled]="loading()">{{ loading() ? 'Signing in...' : 'Sign in' }}</button>
        </form>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: linear-gradient(135deg, #0f172a, #1d4ed8);
        padding: 32px;
      }

      .login-shell {
        min-height: 100vh;
        display: grid;
        place-items: center;
      }

      .login-card {
        width: min(100%, 440px);
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 24px;
        box-shadow: 0 30px 60px rgba(15, 23, 42, 0.4);
        padding: 32px;
        backdrop-filter: blur(14px);
      }

      .brand-block {
        margin-bottom: 28px;
      }

      .eyebrow {
        color: #93c5fd;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      h1 {
        color: #f8fafc;
        margin: 10px 0 8px;
        font-size: 2rem;
      }

      p {
        color: #cbd5e1;
        margin: 0;
      }

      .login-form {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      label {
        display: flex;
        flex-direction: column;
        gap: 8px;
        color: #e2e8f0;
        font-size: 0.92rem;
      }

      input {
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(15, 23, 42, 0.6);
        border-radius: 12px;
        color: white;
        padding: 12px 14px;
        font-size: 1rem;
      }

      button {
        border: none;
        border-radius: 12px;
        padding: 12px 18px;
        background: linear-gradient(135deg, #38bdf8, #2563eb);
        color: white;
        font-weight: 700;
        cursor: pointer;
      }
    `,
  ],
})
export class LoginPage {
  email = 'admin@stms.local';
  password = 'Password123!';
  readonly loading = signal(false);

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  async submit(): Promise<void> {
    this.loading.set(true);
    try {
      await this.authService.login(this.email, this.password);
      this.router.navigateByUrl('/dashboard');
    } finally {
      this.loading.set(false);
    }
  }
}
