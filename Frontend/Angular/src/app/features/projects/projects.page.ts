import { Component } from '@angular/core';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  templateUrl: './projects.page.html',
  styleUrls: ['./projects.page.scss']
})
export class ProjectsPage {
  projects = [
    { name: 'CRM Refresh', status: 'In Progress', owner: 'Aisha', summary: 'Modernize the Salesforce data model and improve onboarding.', tasks: 18, progress: 72 },
    { name: 'ERP Migration', status: 'Planned', owner: 'Sam', summary: 'Move legacy ERP workflows to the new platform.', tasks: 12, progress: 26 },
    { name: 'UX Audit', status: 'Completed', owner: 'Ivy', summary: 'Finalize design QA before launch.', tasks: 9, progress: 100 },
  ];
}
