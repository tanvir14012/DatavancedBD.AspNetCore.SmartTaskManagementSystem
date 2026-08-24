import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="not-found-shell">
      <div class="not-found-card">
        <div class="art" aria-hidden="true">
          <svg viewBox="0 0 420 260" role="img">
            <rect x="18" y="18" width="384" height="224" rx="28" fill="#e0f2fe" />
            <rect x="58" y="58" width="120" height="18" rx="9" fill="#93c5fd" opacity="0.8" />
            <rect x="58" y="90" width="180" height="18" rx="9" fill="#cbd5e1" opacity="0.7" />
            <circle cx="300" cy="120" r="62" fill="#dbeafe" />
            <circle cx="300" cy="120" r="38" fill="#f8fafc" />
            <path d="M286 120h28M300 106v28" stroke="#2563eb" stroke-width="10" stroke-linecap="round" />
            <path d="M121 180h178" stroke="#1d4ed8" stroke-width="12" stroke-linecap="round" opacity="0.7" />
            <path d="M118 200l30 28 54-68 34 42 40-52" fill="none" stroke="#2563eb" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.75" />
          </svg>
        </div>

        <span class="eyebrow">404</span>
        <h1>Page not found</h1>
        <p>The page you were looking for no longer exists or may have moved.</p>

        <div class="actions">
          <a routerLink="/dashboard" class="primary">Back to dashboard</a>
          <a routerLink="/homepage" class="secondary">Go home</a>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: linear-gradient(135deg, #f8fafc, #dbeafe 45%, #eff6ff);
      }

      .not-found-shell {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px;
      }

      .not-found-card {
        width: min(100%, 560px);
        background: rgba(255,255,255,0.8);
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 30px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
        padding: 32px 28px;
        text-align: center;
      }

      .art {
        margin-bottom: 12px;
      }

      svg {
        width: min(100%, 420px);
        height: auto;
      }

      .eyebrow {
        display: inline-block;
        padding: 7px 12px;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.12);
        color: #1d4ed8;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      h1 {
        margin: 18px 0 10px;
        font-size: clamp(2rem, 4vw, 3rem);
        color: #0f172a;
      }

      p {
        margin: 0;
        color: #475569;
        line-height: 1.7;
      }

      .actions {
        display: flex;
        justify-content: center;
        gap: 14px;
        margin-top: 24px;
        flex-wrap: wrap;
      }

      a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 12px 18px;
        border-radius: 12px;
        font-weight: 700;
        text-decoration: none;
      }

      .primary {
        background: linear-gradient(135deg, #2563eb, #0ea5e9);
        color: white;
      }

      .secondary {
        background: #e2e8f0;
        color: #0f172a;
      }
    `,
  ],
})
export class NotFoundPage {}
