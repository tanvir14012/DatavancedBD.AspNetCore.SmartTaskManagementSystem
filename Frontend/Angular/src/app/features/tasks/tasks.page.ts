import { Component } from '@angular/core';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  templateUrl: './tasks.page.html',
  styleUrls: ['./tasks.page.scss']
})
export class TasksPage {
  tasks = [
    { title: 'Define onboarding checklist', status: 'In Progress', priority: 'High', assignee: 'Jane', dueDate: '2026-08-27', project: 'Client Portal' },
    { title: 'Prepare sprint demo', status: 'Pending', priority: 'Medium', assignee: 'Aisha', dueDate: '2026-08-29', project: 'Operations' },
    { title: 'Cleanup integrations', status: 'Completed', priority: 'Low', assignee: 'Sam', dueDate: '2026-08-22', project: 'Integration' },
  ];
}
