import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';
import { CatalogMultimediaContentService, MultimediaVM } from '@erp/catalog/data-access';

const MEDIA_TYPE_ICONS: Record<string, string> = {
  image: '@tui.image',
  video: '@tui.video',
  audio: '@tui.music',
  document: '@tui.file-text',
  '3d-model': '@tui.box',
};

/**
 * Miniaturka w tabeli biblioteki mediów.
 *
 * Bliźniacza do komórki z panelu produktu, ale prostsza o jedno: wierszem jest tu gotowy
 * `MultimediaVM` (lista serwerowa ładuje pełne zasoby), więc komórka nie rozwiązuje niczego
 * po uuid ani nie pokazuje szkieletu ładowania.
 *
 * <b>Nie spada na oryginał, gdy wariantu nie ma</b> — to ten sam powód co w panelu produktu:
 * 6 MB na kwadrat 40×40 jest dokładnie tym, czemu warianty zapobiegają. Zasób bez miniaturki
 * dostaje ikonę typu, a kolumna „Miniatury" mówi wprost, że można je domówić akcją toolbara.
 */
@Component({
  selector: 'erp-multimedia-library-thumbnail-cell',
  standalone: true,
  imports: [TuiIcon],
  template: `
    @if (_previewUrl(); as url) {
      <img [src]="url" [alt]="row().fileName" loading="lazy" class="erp-multimedia-library-thumb__img" />
    } @else {
      <div class="erp-multimedia-library-thumb__box">
        <tui-icon [icon]="_icon()" />
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }

    .erp-multimedia-library-thumb__box,
    .erp-multimedia-library-thumb__img {
      width: 40px;
      height: 40px;
      border-radius: 0.375rem;
      display: block;
      object-fit: cover;
    }

    .erp-multimedia-library-thumb__box {
      background: var(--tui-background-neutral-1);
      color: var(--tui-text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimediaLibraryThumbnailCellComponent {
  public readonly row = input.required<MultimediaVM>();

  private readonly contentService = inject(CatalogMultimediaContentService);

  protected readonly _previewUrl = computed<string | undefined>(() => {
    const vm = this.row();

    if (vm.thumbnailUrl) {
      return vm.thumbnailUrl;
    }

    if (vm.originalUrl) {
      return vm.originalUrl;
    }

    return vm.hasDerivatives ? this.contentService.variantUrl(vm.uuid, 'thumb')() : undefined;
  });

  protected readonly _icon = computed(() => MEDIA_TYPE_ICONS[this.row().mediaType] ?? '@tui.file');
}
