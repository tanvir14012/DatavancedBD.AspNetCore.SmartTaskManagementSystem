import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-homepage-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './homepage.page.html',
  styleUrls: ['./homepage.page.scss']
})
export class HomepagePage {}
