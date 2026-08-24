import { Component } from '@angular/core';

@Component({
  selector: 'app-users-page',
  standalone: true,
  template: `
    <section class="page">
      <div class="page-head">
        <div>
          <p class="eyebrow">Directory</p>
          <h1>Users</h1>
        </div>
        <button class="primary">Invite Member</button>
      </div>

      <div class="user-grid">
        @for (user of users; track user.name) {
          <article class="user-card">
            <img [src]="user.imageUrl" alt="{{ user.name }}" />
            <h2>{{ user.name }}</h2>
            <p>{{ user.role }}</p>
            <span>{{ user.team }}</span>
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
      .user-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 18px; }
      .user-card { background: white; border: 1px solid #e2e8f0; border-radius: 18px; padding: 20px; text-align: center; box-shadow: 0 8px 22px rgba(15,23,42,.04); }
      img { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; margin-bottom: 14px; }
      h2 { margin: 0 0 8px; font-size: 1.1rem; color: #0f172a; }
      p, span { color: #475569; margin: 0; }
    `,
  ],
})
export class UsersPage {
  users = [
    { name: 'Aisha Rahman', role: 'Project Manager', team: 'Delivery', imageUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Aisha' },
    { name: 'Samir Khan', role: 'Team Member', team: 'Product', imageUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Samir' },
    { name: 'Ivy Chen', role: 'Admin', team: 'Operations', imageUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Ivy' },
  ];
}
