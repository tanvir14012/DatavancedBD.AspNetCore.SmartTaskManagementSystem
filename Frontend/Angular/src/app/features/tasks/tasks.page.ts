import { Component } from '@angular/core';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  template: `
    <section class="page">
      <div class="page-head">
        <div>
          <p class="eyebrow">Execution</p>
          <h1>Tasks</h1>
        </div>
        <button class="primary">Create Task</button>
      </div>

      <div class="task-list">
        @for (task of tasks; track task.title) {
          <article class="task-card">
            <div class="row">
              <span class="pill priority-{{ task.priority.toLowerCase() }}">{{ task.priority }}</span>
              <span class="status">{{ task.status }}</span>
            </div>
            <h2>{{ task.title }}</h2>
            <p>{{ task.assignee }}</p>
            <div class="meta-row">
              <span>Due {{ task.dueDate }}</span>
              <span>{{ task.project }}</span>
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
      .task-list { display: grid; gap: 18px; }
      .task-card { background: white; border: 1px solid #e2e8f0; border-radius: 18px; padding: 20px; box-shadow: 0 8px 22px rgba(15,23,42,.04); }
      .row, .meta-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .pill { padding: 5px 10px; border-radius: 999px; font-size: .8rem; font-weight: 700; }
      .priority-high { background: #fee2e2; color: #b91c1c; }
      .priority-medium { background: #fef3c7; color: #a16207; }
      .priority-low { background: #dcfce7; color: #166534; }
      .status { color: #475569; font-weight: 600; }
      h2 { margin: 14px 0 10px; font-size: 1.2rem; color: #0f172a; }
      p { margin: 0 0 14px; color: #475569; }
      .meta-row { color: #64748b; font-size: .85rem; }
    `,
  ],
})
export class TasksPage {
  tasks = [
    { title: 'Define onboarding checklist', status: 'In Progress', priority: 'High', assignee: 'Jane', dueDate: '2026-08-27', project: 'Client Portal' },
    { title: 'Prepare sprint demo', status: 'Pending', priority: 'Medium', assignee: 'Aisha', dueDate: '2026-08-29', project: 'Operations' },
    { title: 'Cleanup integrations', status: 'Completed', priority: 'Low', assignee: 'Sam', dueDate: '2026-08-22', project: 'Integration' },
  ];
}
