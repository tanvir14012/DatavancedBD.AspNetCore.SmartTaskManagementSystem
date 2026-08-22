import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';

export interface MetaConfig {
  titleKey?: string;
  descriptionKey?: string;
  title?: string;
  description?: string;
  keywords?: string;
  robots?: string;
  canonicalUrl?: string;
  ogType?: string;
  ogImage?: string;
  locale?: string;
}

@Injectable({ providedIn: 'root' })
export class MetaService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly translate = inject(TranslateService);
  private readonly appName = 'USM Inventory';

  setMeta(config: MetaConfig): void {
    const translated =
      config.title ?? (config.titleKey ? this.translate.instant(config.titleKey) : this.appName);
    const description =
      config.description ??
      (config.descriptionKey ? this.translate.instant(config.descriptionKey) : undefined);
    const fullTitle =
      translated !== this.appName ? `${translated} | ${this.appName}` : this.appName;

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });

    if (description) {
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:description', content: description });
      this.meta.updateTag({ name: 'twitter:description', content: description });
    }
    if (config.keywords) {
      this.meta.updateTag({ name: 'keywords', content: config.keywords });
    }
    this.meta.updateTag({ name: 'robots', content: config.robots ?? 'noindex,nofollow' });
    this.meta.updateTag({ property: 'og:type', content: config.ogType ?? 'website' });
    this.meta.updateTag({
      name: 'twitter:card',
      content: config.ogImage ? 'summary_large_image' : 'summary',
    });
    if (config.locale) {
      this.meta.updateTag({ property: 'og:locale', content: config.locale });
    }
    if (config.canonicalUrl) {
      this.setCanonical(config.canonicalUrl);
      this.meta.updateTag({ property: 'og:url', content: config.canonicalUrl });
    }
    if (config.ogImage) {
      this.meta.updateTag({ property: 'og:image', content: config.ogImage });
      this.meta.updateTag({ name: 'twitter:image', content: config.ogImage });
    }
  }

  private setCanonical(url: string): void {
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;
  }
}
