import { Pipe, PipeTransform, Inject, Optional, ChangeDetectorRef } from '@angular/core';
import { TranslocoPipe, TranslocoService, TRANSLOCO_SCOPE, TRANSLOCO_LANG } from '@jsverse/transloco';
import { Translatable } from './erp-signal-utils';

@Pipe({
  name: 'erpTranslate',
  standalone: true,
  pure: false
})
export class ErpTranslatePipe extends TranslocoPipe implements PipeTransform {
  constructor(
    service: TranslocoService,
    @Optional() @Inject(TRANSLOCO_SCOPE) providerScope: any,
    @Optional() @Inject(TRANSLOCO_LANG) providerLang: any,
    cdr: ChangeDetectorRef
  ) {
    super(service, providerScope, providerLang, cdr);
  }

  override transform(value: Translatable | null | undefined, params?: any): string {
    if (!value) return '';
    if (typeof value === 'string') {
      return super.transform(value, params);
    }
    return super.transform(value.key, value.params || params);
  }
}
