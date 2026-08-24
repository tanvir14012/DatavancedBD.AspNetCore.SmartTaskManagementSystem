import { Component } from '@angular/core';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  template: `
    <section class="page">
      <div class="page-head">
        <div>
          <p class="eyebrow">Portfolio</p>
          <h1>Projects</h1>
        </div>
        <button class="primary">New Project</button>
      </div>

      <div class="project-grid">
        @for (project of projects; track project.name) {
          <article class="project-card">
            <div class="meta-row">
              <span class="pill">{{ project.status }}</span>
              <span>{{ project.owner }}</span>
            </div>
            <h2>{{ project.name }}</h2>
            <p>{{ project.summary }}</p>
            <div class="footer-row">
              <span>{{ project.tasks }} tasks</span>
              <span>{{ project.progress }}% complete</span>
            </div>
          </article>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .page { display: flex; flex-direction: column; gap: 24px; }
      .page-head { display: flex; justify-content: space-between; align-items: center; }
      .eyebrow { text-transform: uppercase; letter-spacing: .12em; color: #64748b; font-size: 11px; margin: 0 0 6px; }
      h1 { margin: 0; font-size: 2rem; color: #0f172a; }
      .primary { border: none; background: #2563eb; color: white; padding: 10px 16px; border-radius: 10px; font-weight: 700; }
      .project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; }
      .project-card { background: white; border: 1px solid #e2e8f0; border-radius: 18px; padding: 20px; box-shadow: 0 8px 22px rgba(15,23,42,.04); }
      .meta-row, .footer-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; color: #475569; font-size: .85rem; }
      .pill { background: #dbeafe; color: #1d4ed8; padding: 5px 10px; border-radius: 999px; font-weight: 700; }
      h2 { margin: 16px 0 12px; font-size: 1.2rem; color: #0f172a; }
      p { margin: 0 0 16px; color: #475569; line-height: 1.6; }
    `,
  ],
})
export class ProjectsPage {
  projects = [
    { name: 'CRM Refresh', status: 'In Progress', owner: 'Aisha', summary: 'Modernize the Salesforce data model and improve onboarding.', tasks: 18, progress: 72 },
    { name: 'ERP Migration', status: 'Planned', owner: 'Sam', summary: 'Move legacy ERP workflows to the new platform.', tasks: 12, progress: 26 },
    { name: 'UX Audit', status: 'Completed', owner: 'Ivy', summary: 'Finalize design QA before launch.', tasks: 9, progress: 100 },
  ];
}
