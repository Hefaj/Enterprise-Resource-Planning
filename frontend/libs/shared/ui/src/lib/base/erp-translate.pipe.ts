import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Translatable } from './erp-signal-utils';

@Pipe({
  name: 'erpTranslate',
  standalone: true,
  pure: false
})
export class ErpTranslatePipe implements PipeTransform {
  private transloco = inject(TranslocoService);

  transform(value: Translatable | null | undefined): string {
    if (!value) return '';
    if (typeof value === 'string') {
      return this.transloco.translate(value);
    }
    return this.transloco.translate(value.key, value.params);
  }
}
