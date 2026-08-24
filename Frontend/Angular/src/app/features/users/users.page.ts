import { Component } from '@angular/core';

@Component({
  selector: 'app-users-page',
  standalone: true,
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss']
})
export class UsersPage {
  users = [
    { name: 'Aisha Rahman', role: 'Project Manager', team: 'Delivery', imageUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Aisha' },
    { name: 'Samir Khan', role: 'Team Member', team: 'Product', imageUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Samir' },
    { name: 'Ivy Chen', role: 'Admin', team: 'Operations', imageUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Ivy' },
  ];
}
