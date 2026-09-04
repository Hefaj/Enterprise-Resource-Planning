import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErpGridLayoutBuilder, ErpGridLayoutComponent } from '@erp/shared/ui';

import { MultimediaStore } from './multimedia.store';
import { provideMultimediaTranslations } from '../translation';
import { MultimediaFilterComponent } from './filters/multimedia-filter.component';
import { MultimediaLibraryTabComponent } from './content/multimedia-library-tab.component';

/**
 * Biblioteka mediów — lista wszystkich zasobów katalogu, niezależna od produktów.
 *
 * <b>Bez zakładek i bez prawego panelu</b>, bo strona ma tylko listę i akcje nad nią
 * (`docs/guides/frontend/pages.md` §3: zakładki dokłada się dopiero wtedy, gdy jest alternatywny
 * widok zależny od zaznaczenia). Siatka ma więc dwa obszary zamiast czterech.
 */
@Component({
  standalone: true,
  imports: [ErpGridLayoutComponent],
  providers: [MultimediaStore, provideMultimediaTranslations()],
  template: `<erp-grid-layout [config]="pageConfig" />`,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimediaComponent {
  protected readonly pageConfig = ErpGridLayoutBuilder.create(b => b
    .setLayoutId('catalog-multimedia-page')
    .setShowBorders(true)
    .setGrid({
      areas: ['filter content'],
      columns: '280px 1fr',
      rows: '1fr',
      gap: '0',
    })
    .fill('filter', MultimediaFilterComponent)
    .fill('content', MultimediaLibraryTabComponent)
  );
}
