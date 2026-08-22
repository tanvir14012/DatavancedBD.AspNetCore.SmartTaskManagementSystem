import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageSelectorComponent } from '../../shared/components/language-selector/language-selector.component';

interface Capability {
  icon: string;
  title: string;
  desc: string;
}

interface GalleryImage {
  src: string;
  alt: string;
  caption: string;
  credit: string;
  fallbackColor: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, LanguageSelectorComponent, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class HomeComponent {
  private readonly router = inject(Router);

  readonly isScrolled = signal(false);
  readonly menuOpen = signal(false);
  readonly year = new Date().getFullYear();

  @HostListener('window:scroll')
  onScroll(): void {
    this.isScrolled.set(window.scrollY > 40);
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }
  closeMenu(): void {
    this.menuOpen.set(false);
  }
  goToLogin(): void {
    this.router.navigateByUrl('/login');
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  readonly stats = [
    { value: '14+', label: 'Service Modules' },
    { value: '3', label: 'Auth Methods' },
    { value: 'Real-Time', label: 'Supply Tracking' },
    { value: 'Multi-Site', label: 'Deployment Ready' },
  ];

  readonly branches = [
    {
      name: 'Army',
      seal: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Seal_of_the_United_States_Department_of_the_Army.svg/200px-Seal_of_the_United_States_Department_of_the_Army.svg.png',
    },
    {
      name: 'Navy',
      seal: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Seal_of_the_United_States_Department_of_the_Navy.svg/200px-Seal_of_the_United_States_Department_of_the_Navy.svg.png',
    },
    {
      name: 'Air Force',
      seal: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Seal_of_the_Department_of_the_Air_Force.svg/200px-Seal_of_the_Department_of_the_Air_Force.svg.png',
    },
    {
      name: 'Marine Corps',
      seal: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/United_States_Marine_Corps_Logo.svg/200px-United_States_Marine_Corps_Logo.svg.png',
    },
    {
      name: 'Coast Guard',
      seal: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Seal_of_the_United_States_Coast_Guard.svg/200px-Seal_of_the_United_States_Coast_Guard.svg.png',
    },
  ];

  readonly capabilities: Capability[] = [
    {
      icon: '📦',
      title: 'Issue & Receipt',
      desc: 'Track all supply issuances and receipts with real-time audit trails and digital signatures.',
    },
    {
      icon: '🏭',
      title: 'Storehouse Management',
      desc: 'Full warehouse inventory control, bin management, and capacity planning.',
    },
    {
      icon: '🛒',
      title: 'Procurement',
      desc: 'Automated purchase requisitions, vendor management, and approval workflows.',
    },
    {
      icon: '🔧',
      title: 'Repair & Maintenance',
      desc: 'Equipment lifecycle tracking, maintenance scheduling, and work order management.',
    },
    {
      icon: '📊',
      title: 'Budget Planning',
      desc: 'Budget allocation, expenditure tracking, and financial reporting across all units.',
    },
    {
      icon: '📋',
      title: 'Reporting',
      desc: 'Comprehensive real-time dashboards and exportable reports for command oversight.',
    },
    {
      icon: '🚔',
      title: 'Traffic & Security',
      desc: 'Gate access management, vehicle logging, and security checkpoint integration.',
    },
    {
      icon: '♻️',
      title: 'Salvage',
      desc: 'Manage condemned equipment, disposal processes, and salvage valuation.',
    },
    {
      icon: '📄',
      title: 'Document Share',
      desc: 'Secure distribution of supply orders, manifests, and technical documentation.',
    },
    {
      icon: '📡',
      title: 'Communication',
      desc: 'Internal messaging and notification system for supply chain stakeholders.',
    },
    {
      icon: '🏛️',
      title: 'Administration',
      desc: 'Unit management, organizational hierarchy, and configuration of system settings.',
    },
    {
      icon: '👤',
      title: 'IAM',
      desc: 'Identity and access management with role-based permissions and audit logging.',
    },
    {
      icon: '🔍',
      title: 'Inspectorate',
      desc: 'Inspection scheduling, checklist management, and compliance reporting.',
    },
    {
      icon: '📈',
      title: 'Dashboard',
      desc: 'Executive overview of all supply chain KPIs, alerts, and operational status.',
    },
  ];

  readonly galleryImages: GalleryImage[] = [
    {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/USMC-120130-M-AU422-173.jpg/800px-USMC-120130-M-AU422-173.jpg',
      alt: 'U.S. Marines supply operations',
      caption: 'Marine Corps Supply Operations',
      credit: 'Public Domain · U.S. Marine Corps',
      fallbackColor: 'linear-gradient(135deg,#1a3a2a,#0f2318)',
    },
    {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/USAF_Aircraft_on_Flightline.jpg/800px-USAF_Aircraft_on_Flightline.jpg',
      alt: 'U.S. Air Force logistics',
      caption: 'Air Force Logistics Support',
      credit: 'Public Domain · U.S. Air Force',
      fallbackColor: 'linear-gradient(135deg,#1a2a3a,#0f1823)',
    },
    {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Defense.gov_photo_essay_100908-A-3108M-002.jpg/800px-Defense.gov_photo_essay_100908-A-3108M-002.jpg',
      alt: 'U.S. Army supply depot operations',
      caption: 'Army Supply Depot Operations',
      credit: 'Public Domain · U.S. Army',
      fallbackColor: 'linear-gradient(135deg,#2a2a1a,#18180f)',
    },
  ];
}
