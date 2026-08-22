import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, MetaDefinition, Title } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JsonLdObject, JsonLdService } from '../seo/json-ld.service';
import { SeoConfig, SeoManagerService } from '../seo/seo-manager.service';
import { PlatformContextService } from '../ssr/platform-context.service';

class TitleServiceMock {
  readonly setTitle = vi.fn<(title: string) => void>();
}

class MetaServiceMock {
  readonly updateTag = vi
    .fn<(tag: MetaDefinition, selector?: string) => HTMLMetaElement | null>()
    .mockReturnValue(null);

  readonly removeTag = vi.fn<(selector: string) => void>();
}

describe('Shared services mocks', () => {
  beforeEach(() => {
    document.head
      .querySelectorAll('link[rel="canonical"], script[id^="json-ld-"]')
      .forEach((element) => element.remove());
  });

  it('PlatformContextService should detect server platform safely', () => {
    TestBed.configureTestingModule({
      providers: [
        PlatformContextService,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: DOCUMENT, useValue: document },
      ],
    });

    const service = TestBed.inject(PlatformContextService);

    expect(service.isServer).toBe(true);
    expect(service.isBrowser).toBe(false);
    expect(service.getWindow()).toBeNull();
    expect(service.getDocument()).toBe(document);
  });

  it('SeoManagerService should update title, social tags, and canonical link', () => {
    const titleMock = new TitleServiceMock();
    const metaMock = new MetaServiceMock();

    TestBed.configureTestingModule({
      providers: [
        SeoManagerService,
        PlatformContextService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: document },
        { provide: Title, useValue: titleMock },
        { provide: Meta, useValue: metaMock },
      ],
    });

    const service = TestBed.inject(SeoManagerService);

    const config: SeoConfig = {
      title: 'Inventory Dashboard',
      description: 'Enterprise inventory insights',
      url: 'https://example.com/inventory',
      image: 'https://example.com/assets/og-image.png',
      keywords: ['inventory', 'analytics', 'enterprise'],
      twitterCard: 'summary_large_image',
      ogType: 'website',
    };

    service.updateSeo(config);

    expect(titleMock.setTitle).toHaveBeenCalledWith(config.title);
    expect(metaMock.updateTag).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'description',
        content: config.description,
      }),
      'name="description"',
    );

    const canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    expect(canonicalLink).not.toBeNull();
    expect(canonicalLink?.href).toBe(config.url);
  });

  it('JsonLdService should inject and update JSON-LD script content', () => {
    TestBed.configureTestingModule({
      providers: [
        JsonLdService,
        PlatformContextService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: document },
      ],
    });

    const service = TestBed.inject(JsonLdService);
    const schema: JsonLdObject = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'USM Inventory',
      url: 'https://example.com',
    };

    service.setSchema('org-schema', schema);

    const script = document.head.querySelector<HTMLScriptElement>('script#json-ld-org-schema');
    expect(script).not.toBeNull();
    expect(script?.type).toBe('application/ld+json');
    expect(script?.text).toContain('"@type":"Organization"');
  });
});
