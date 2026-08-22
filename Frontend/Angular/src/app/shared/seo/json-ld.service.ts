import { DOCUMENT } from '@angular/common';
import {
  inject,
  Injectable,
  Pipe,
  PipeTransform,
  Renderer2,
  RendererFactory2,
} from '@angular/core';

import { PlatformContextService } from '../ssr/platform-context.service';

export type JsonLdPrimitive = string | number | boolean | null;
export type JsonLdValue = JsonLdPrimitive | JsonLdObject | JsonLdValue[];
export interface JsonLdObject {
  [key: string]: JsonLdValue;
}

@Injectable({
  providedIn: 'root',
})
export class JsonLdService {
  private static readonly scriptIdPrefix = 'json-ld-';

  private readonly documentRef = inject(DOCUMENT, { optional: true });
  private readonly rendererFactory = inject(RendererFactory2);
  private readonly platformContext = inject(PlatformContextService);
  private readonly renderer: Renderer2 = this.rendererFactory.createRenderer(null, null);

  setSchema(id: string, schema: JsonLdObject): void {
    const safeDocument = this.documentRef ?? this.platformContext.getDocument();
    if (!safeDocument?.head) {
      return;
    }

    const sanitizedId = id.trim().replace(/\s+/g, '-').toLowerCase();
    const scriptId = `${JsonLdService.scriptIdPrefix}${sanitizedId}`;

    let script = safeDocument.head.querySelector<HTMLScriptElement>(`script#${scriptId}`);
    if (!script) {
      script = this.renderer.createElement('script') as HTMLScriptElement;
      this.renderer.setAttribute(script, 'id', scriptId);
      this.renderer.setAttribute(script, 'type', 'application/ld+json');
      this.renderer.appendChild(safeDocument.head, script);
    }

    this.renderer.setProperty(script, 'text', this.serialize(schema));
  }

  removeSchema(id: string): void {
    const safeDocument = this.documentRef ?? this.platformContext.getDocument();
    if (!safeDocument?.head) {
      return;
    }

    const sanitizedId = id.trim().replace(/\s+/g, '-').toLowerCase();
    const scriptId = `${JsonLdService.scriptIdPrefix}${sanitizedId}`;
    const script = safeDocument.head.querySelector<HTMLScriptElement>(`script#${scriptId}`);
    if (script) {
      this.renderer.removeChild(safeDocument.head, script);
    }
  }

  serialize(schema: JsonLdObject | readonly JsonLdObject[]): string {
    return JSON.stringify(schema).replace(/</g, '\\u003c');
  }
}

@Pipe({
  name: 'jsonLd',
  standalone: true,
  pure: true,
})
export class JsonLdPipe implements PipeTransform {
  private readonly jsonLdService = inject(JsonLdService);

  transform(schema: JsonLdObject | readonly JsonLdObject[] | null | undefined): string {
    if (!schema) {
      return '';
    }

    return this.jsonLdService.serialize(schema);
  }
}
