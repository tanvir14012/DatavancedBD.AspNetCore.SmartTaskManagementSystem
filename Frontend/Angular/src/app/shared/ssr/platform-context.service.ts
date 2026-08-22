import { DOCUMENT, isPlatformBrowser, isPlatformServer } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PlatformContextService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly documentRef = inject(DOCUMENT, { optional: true });

  readonly isBrowser = isPlatformBrowser(this.platformId);
  readonly isServer = isPlatformServer(this.platformId);

  getWindow(): Window | null {
    return this.isBrowser && typeof window !== 'undefined' ? window : null;
  }

  getDocument(): Document | null {
    if (this.documentRef) {
      return this.documentRef;
    }

    return this.isBrowser && typeof document !== 'undefined' ? document : null;
  }

  getLocalStorage(): Storage | null {
    const safeWindow = this.getWindow();
    return safeWindow?.localStorage ?? null;
  }

  safeQuerySelector<T extends Element = Element>(selector: string): T | null {
    return this.getDocument()?.querySelector<T>(selector) ?? null;
  }

  safeCreateElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
  ): HTMLElementTagNameMap[K] | null {
    const safeDocument = this.getDocument();
    return safeDocument ? safeDocument.createElement(tagName) : null;
  }
}
