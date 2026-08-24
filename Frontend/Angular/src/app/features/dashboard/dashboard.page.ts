import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  template: `
    <section class="page">
      <div class="header-row">
        <div>
          <p class="eyebrow">Overview</p>
          <h1>Dashboard</h1>
        </div>
      </div>

      <div class="stats-grid">
        <article class="stat-card accent">
          <span>Total Projects</span>
          <strong>18</strong>
        </article>
        <article class="stat-card">
          <span>Total Tasks</span>
          <strong>128</strong>
        </article>
        <article class="stat-card warn">
          <span>Pending</span>
          <strong>46</strong>
        </article>
        <article class="stat-card success">
          <span>Completed</span>
          <strong>82</strong>
        </article>
      </div>

      <div class="panel-grid">
        <article class="panel">
          <h2>Priority mix</h2>
          <ul>
            <li>High: 12</li>
            <li>Medium: 31</li>
            <li>Low: 44</li>
          </ul>
        </article>

        <article class="panel">
          <h2>Upcoming due</h2>
          <ul>
            <li>API contract review — today</li>
            <li>Mobile release checklist — tomorrow</li>
            <li>Support backlog cleanup — Friday</li>
          </ul>
        </article>
      </div>
    </section>
  `,
  styles: [
    `
      .page { display: flex; flex-direction: column; gap: 24px; }
      .header-row { display: flex; justify-content: space-between; align-items: center; }
      .eyebrow { text-transform: uppercase; letter-spacing: .12em; color: #64748b; font-size: 11px; margin: 0 0 6px; }
      h1 { margin: 0; font-size: 2rem; color: #0f172a; }
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap: 18px; }
      .stat-card, .panel { background: white; border: 1px solid #e2e8f0; border-radius: 18px; padding: 20px; box-shadow: 0 8px 22px rgba(15,23,42,.04); }
      .stat-card { display: flex; flex-direction: column; gap: 12px; color: #334155; }
      .stat-card strong { font-size: 2rem; color: #0f172a; }
      .stat-card.accent { background: linear-gradient(135deg,#dbeafe,#eff6ff); }
      .stat-card.warn { background: linear-gradient(135deg,#fef3c7,#fff7ed); }
      .stat-card.success { background: linear-gradient(135deg,#dcfce7,#f0fdf4); }
      .panel-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }
      h2 { margin-top: 0; color: #0f172a; }
      ul { margin: 0; padding-left: 18px; color: #475569; line-height: 1.8; }
    `,
  ],
})
export class DashboardPage {}
