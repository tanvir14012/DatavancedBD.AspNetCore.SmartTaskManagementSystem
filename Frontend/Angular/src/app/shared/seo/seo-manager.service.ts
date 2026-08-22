import { DOCUMENT } from '@angular/common';
import { inject, Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { Meta, MetaDefinition, Title } from '@angular/platform-browser';

import { PlatformContextService } from '../ssr/platform-context.service';

export type TwitterCardType = 'summary' | 'summary_large_image' | 'app' | 'player';
export type OpenGraphType =
  'website' | 'article' | 'book' | 'profile' | 'music.song' | 'video.movie';

export interface SeoConfig {
  title: string;
  description: string;
  image?: string;
  url?: string;
  keywords?: readonly string[];
  canonicalUrl?: string;
  twitterCard?: TwitterCardType;
  ogType?: OpenGraphType;
}

@Injectable({
  providedIn: 'root',
})
export class SeoManagerService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly documentRef = inject(DOCUMENT, { optional: true });
  private readonly rendererFactory = inject(RendererFactory2);
  private readonly platformContext = inject(PlatformContextService);
  private readonly renderer: Renderer2 = this.rendererFactory.createRenderer(null, null);

  updateSeo(config: SeoConfig): void {
    const canonicalUrl = config.canonicalUrl ?? config.url;

    this.title.setTitle(config.title);
    this.upsertMetaTag({ name: 'description', content: config.description }, 'name="description"');

    if (config.keywords?.length) {
      this.upsertMetaTag(
        {
          name: 'keywords',
          content: config.keywords.join(', '),
        },
        'name="keywords"',
      );
    } else {
      this.meta.removeTag('name="keywords"');
    }

    this.upsertOpenGraph(config, canonicalUrl);
    this.upsertTwitter(config, canonicalUrl);
    this.upsertCanonical(canonicalUrl);
  }

  private upsertOpenGraph(config: SeoConfig, canonicalUrl?: string): void {
    this.upsertMetaTag({ property: 'og:title', content: config.title }, 'property="og:title"');
    this.upsertMetaTag(
      { property: 'og:description', content: config.description },
      'property="og:description"',
    );
    this.upsertMetaTag(
      { property: 'og:type', content: config.ogType ?? 'website' },
      'property="og:type"',
    );

    if (canonicalUrl) {
      this.upsertMetaTag({ property: 'og:url', content: canonicalUrl }, 'property="og:url"');
    } else {
      this.meta.removeTag('property="og:url"');
    }

    if (config.image) {
      this.upsertMetaTag({ property: 'og:image', content: config.image }, 'property="og:image"');
    } else {
      this.meta.removeTag('property="og:image"');
    }
  }

  private upsertTwitter(config: SeoConfig, canonicalUrl?: string): void {
    this.upsertMetaTag(
      { name: 'twitter:card', content: config.twitterCard ?? 'summary_large_image' },
      'name="twitter:card"',
    );
    this.upsertMetaTag({ name: 'twitter:title', content: config.title }, 'name="twitter:title"');
    this.upsertMetaTag(
      { name: 'twitter:description', content: config.description },
      'name="twitter:description"',
    );

    if (config.image) {
      this.upsertMetaTag({ name: 'twitter:image', content: config.image }, 'name="twitter:image"');
    } else {
      this.meta.removeTag('name="twitter:image"');
    }

    if (canonicalUrl) {
      this.upsertMetaTag({ name: 'twitter:url', content: canonicalUrl }, 'name="twitter:url"');
    } else {
      this.meta.removeTag('name="twitter:url"');
    }
  }

  private upsertCanonical(canonicalUrl?: string): void {
    const safeDocument = this.documentRef ?? this.platformContext.getDocument();
    if (!safeDocument?.head) {
      return;
    }

    const existingCanonical =
      safeDocument.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!canonicalUrl) {
      if (existingCanonical) {
        this.renderer.removeChild(safeDocument.head, existingCanonical);
      }
      return;
    }

    const canonicalLink =
      existingCanonical ?? (this.renderer.createElement('link') as HTMLLinkElement);

    this.renderer.setAttribute(canonicalLink, 'rel', 'canonical');
    this.renderer.setAttribute(canonicalLink, 'href', canonicalUrl);

    if (!existingCanonical) {
      this.renderer.appendChild(safeDocument.head, canonicalLink);
    }
  }

  private upsertMetaTag(definition: MetaDefinition, selector: string): void {
    this.meta.updateTag(definition, selector);
  }
}
