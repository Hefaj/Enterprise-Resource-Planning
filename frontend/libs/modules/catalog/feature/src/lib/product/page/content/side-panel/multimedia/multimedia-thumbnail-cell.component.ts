import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon } from '@taiga-ui/core';
import { TuiSkeleton } from '@taiga-ui/kit';
import { CatalogMultimediaContentService, CatalogMultimediaOrchestrator, MultimediaVM } from '@erp/catalog/data-access';
import { MultimediaRow } from './multimedia-row.model';

const MEDIA_TYPE_ICONS: Record<string, string> = {
  image: '@tui.image',
  video: '@tui.video',
  audio: '@tui.music',
  document: '@tui.file-text',
  '3d-model': '@tui.box',
};

/**
 * Komórka tabeli multimediów — miniaturka. Sama rozwiązuje `MultimediaVM` po `uuid`
 * z cache orkiestratora (reaktywnie), więc renderuje się od razu, gdy dane zostaną
 * doładowane (patrz `MultimediaRow`), niezależnie od tego, kiedy wiersz powstał.
 */
@Component({
  selector: 'erp-multimedia-thumbnail-cell',
  standalone: true,
  imports: [CommonModule, TuiIcon, TuiSkeleton],
  template: `
    <div
      class="erp-multimedia-thumbnail-cell"
      role="button"
      tabindex="0"
      (click)="onPreviewClick()"
      (keydown.enter)="onPreviewClick()"
      (keydown.space)="onPreviewClick()"
    >
      @if (!_vm()) {
        <div [tuiSkeleton]="true" class="erp-multimedia-thumbnail-cell__box"></div>
      } @else if (_previewUrl()) {
        <img [src]="_previewUrl()" [alt]="_vm()!.fileName" loading="lazy" class="erp-multimedia-thumbnail-cell__img" />
      } @else {
        <div class="erp-multimedia-thumbnail-cell__box erp-multimedia-thumbnail-cell__box--icon">
          <tui-icon [icon]="_icon()" />
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .erp-multimedia-thumbnail-cell {
      cursor: pointer;
    }

    .erp-multimedia-thumbnail-cell__box,
    .erp-multimedia-thumbnail-cell__img {
      width: var(--erp-multimedia-thumb-size, 40px);
      height: var(--erp-multimedia-thumb-size, 40px);
      border-radius: 0.375rem;
      display: block;
      object-fit: cover;
    }

    .erp-multimedia-thumbnail-cell__box--icon {
      background: var(--tui-background-neutral-1);
      color: var(--tui-text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimediaThumbnailCellComponent {
  public readonly row = input.required<MultimediaRow>();

  private readonly multimediaOrchestrator = inject(CatalogMultimediaOrchestrator);
  private readonly contentService = inject(CatalogMultimediaContentService);

  protected readonly _vm = computed<MultimediaVM | undefined>(() =>
    this.multimediaOrchestrator.getOne(this.row().uuid)()
  );

  /**
   * Adres miniaturki, w trzech wariantach — w tej kolejności:
   * 1. gotowa miniaturka (dziś nikt jej nie produkuje, ale kolumna istnieje),
   * 2. adres zewnętrzny, gdy zasób leży poza systemem,
   * 3. zawartość z naszego magazynu, pobrana `HttpClient`-em i podana jako `blob:`.
   *
   * Wariant 3 dotyczy WYŁĄCZNIE obrazów: dla wideo czy dokumentu ściąganie całego pliku po to,
   * żeby pokazać kwadrat 40×40, byłoby marnotrawstwem — te dostają ikonę typu.
   *
   * <b>Dlaczego nie da się po prostu wstawić adresu endpointu w `src`.</b> Zawartość jest za
   * uprawnieniem, a `<img>` nie dokłada nagłówka `Authorization` — patrz
   * `CatalogMultimediaContentService`.
   */
  protected readonly _previewUrl = computed<string | undefined>(() => {
    const vm = this._vm();

    if (!vm) {
      return undefined;
    }

    if (vm.thumbnailUrl) {
      return vm.thumbnailUrl;
    }

    if (vm.originalUrl) {
      return vm.originalUrl;
    }

    return vm.mediaType === 'image' ? this.contentService.contentUrl(vm.uuid)() : undefined;
  });

  protected readonly _icon = computed(() => MEDIA_TYPE_ICONS[this._vm()?.mediaType ?? ''] ?? '@tui.file');

  protected onPreviewClick(): void {
    if (!this._vm()) return;
    console.log('Preview', this.row().uuid);
  }
}
