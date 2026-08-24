import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-homepage-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page-shell">
      <header class="site-header">
        <div class="brand-wrap">
          <div class="brand-mark">ST</div>
          <div>
            <span class="brand-name">SmartTask</span>
            <small>Project Management</small>
          </div>
        </div>

        <nav class="nav-links" aria-label="Main navigation">
          <a routerLink="/login">Login</a>
          <a routerLink="/register">Register</a>
        </nav>
      </header>

      <main>
        <section class="hero">
          <div class="hero-copy">
            <span class="eyebrow">Built for lean, fast-moving teams</span>
            <h1>Manage projects, tasks, and delivery in one smart workspace.</h1>
            <p>
              Smart Project Management System helps teams plan work, track progress, and move work from
              ideation to delivery without the chaos of scattered updates.
            </p>

            <div class="cta-row">
              <a class="primary" routerLink="/login">Go to login</a>
              <a class="secondary" routerLink="/register">Create account</a>
            </div>
          </div>

          <div class="hero-art" aria-hidden="true">
            <svg viewBox="0 0 560 420" role="img">
              <defs>
                <linearGradient id="bgGlow" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" stop-color="#60a5fa" />
                  <stop offset="100%" stop-color="#312e81" />
                </linearGradient>
              </defs>
              <rect x="24" y="32" width="500" height="340" rx="28" fill="rgba(15,23,42,0.75)" />
              <rect x="70" y="90" width="180" height="12" rx="6" fill="#93c5fd" opacity="0.8" />
              <rect x="70" y="115" width="210" height="12" rx="6" fill="#cbd5e1" opacity="0.7" />
              <rect x="70" y="150" width="210" height="120" rx="18" fill="url(#bgGlow)" opacity="0.9" />
              <rect x="300" y="150" width="170" height="52" rx="14" fill="#f8fafc" opacity="0.95" />
              <rect x="300" y="222" width="170" height="16" rx="8" fill="#cbd5e1" opacity="0.8" />
              <rect x="300" y="250" width="126" height="16" rx="8" fill="#cbd5e1" opacity="0.8" />
              <circle cx="109" cy="210" r="22" fill="#fef3c7" />
              <path d="M95 210l10 10 22-27" fill="none" stroke="#1f2937" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
              <rect x="154" y="175" width="98" height="18" rx="9" fill="#e0f2fe" opacity="0.9" />
              <rect x="154" y="207" width="82" height="18" rx="9" fill="#e0f2fe" opacity="0.8" />
              <rect x="154" y="239" width="106" height="18" rx="9" fill="#e0f2fe" opacity="0.7" />
            </svg>
          </div>
        </section>

        <section class="feature-grid">
          <article class="feature-card">
            <span class="feature-icon">⚡</span>
            <h2>Real-time planning</h2>
            <p>Prioritize initiatives, track sprint work, and keep delivery visible for every team.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon">👥</span>
            <h2>Team visibility</h2>
            <p>Coordinate tasks, users, and responsibilities across projects without losing context.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon">📊</span>
            <h2>Actionable insights</h2>
            <p>Monitor workload, project health, and progress through a clear dashboard overview.</p>
          </article>
        </section>
      </main>

      <footer class="site-footer">
        <p>© 2026 SmartTask • Built for modern teams</p>
      </footer>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: linear-gradient(180deg, #f8fafc, #e0f2fe 42%, #f8fafc);
        color: #0f172a;
      }

      .page-shell {
        max-width: 1200px;
        margin: 0 auto;
        padding: 32px 24px 48px;
      }

      .site-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 0 28px;
      }

      .brand-wrap {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .brand-mark {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 12px;
        background: linear-gradient(135deg, #2563eb, #38bdf8);
        color: white;
        font-weight: 700;
      }

      .brand-name {
        display: block;
        font-weight: 800;
      }

      .brand-wrap small {
        color: #475569;
      }

      .nav-links {
        display: flex;
        gap: 18px;
        align-items: center;
      }

      .nav-links a,
      .cta-row a {
        text-decoration: none;
        transition: opacity 0.2s ease;
      }

      .nav-links a {
        color: #1e293b;
        font-weight: 600;
      }

      .hero {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 28px;
        align-items: center;
        padding: 52px 0 28px;
      }

      .eyebrow {
        display: inline-block;
        margin-bottom: 22px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.12);
        color: #1d4ed8;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0 0 18px;
        font-size: clamp(2.5rem, 4vw, 4.2rem);
        line-height: 1.08;
      }

      .hero-copy p {
        max-width: 620px;
        color: #475569;
        font-size: 1.08rem;
        line-height: 1.7;
      }

      .cta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-top: 28px;
      }

      .primary,
      .secondary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 14px 22px;
        border-radius: 12px;
        font-weight: 700;
      }

      .primary {
        background: linear-gradient(135deg, #2563eb, #0ea5e9);
        color: white;
      }

      .secondary {
        background: #e2e8f0;
        color: #0f172a;
      }

      .hero-art {
        display: flex;
        justify-content: center;
      }

      .hero-art svg {
        width: min(100%, 560px);
        height: auto;
        filter: drop-shadow(0 22px 40px rgba(37, 99, 235, 0.18));
      }

      .feature-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px;
        margin-top: 24px;
      }

      .feature-card {
        background: rgba(255, 255, 255, 0.75);
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 22px;
        padding: 28px 24px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
      }

      .feature-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        border-radius: 16px;
        background: #dbeafe;
        font-size: 1.7rem;
        margin-bottom: 18px;
      }

      .feature-card h2 {
        margin: 0 0 10px;
        font-size: 1.3rem;
      }

      .feature-card p {
        margin: 0;
        color: #475569;
        line-height: 1.7;
      }

      .site-footer {
        text-align: center;
        padding-top: 26px;
        color: #475569;
      }

      @media (max-width: 800px) {
        .hero {
          grid-template-columns: 1fr;
        }

        .feature-grid {
          grid-template-columns: 1fr;
        }

        .site-header {
          flex-direction: column;
          gap: 18px;
        }
      }
    `,
  ],
})
export class HomepagePage {}
