import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon } from '@taiga-ui/core';
import { TuiSkeleton } from '@taiga-ui/kit';
import { CatalogMultimediaOrchestrator, MultimediaVM } from '@erp/catalog/data-access';
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
    <div class="erp-multimedia-thumbnail-cell" (click)="onPreviewClick()">
      @if (!_vm()) {
        <div [tuiSkeleton]="true" class="erp-multimedia-thumbnail-cell__box"></div>
      } @else if (_vm()!.thumbnailUrl) {
        <img [src]="_vm()!.thumbnailUrl" [alt]="_vm()!.fileName" loading="lazy" class="erp-multimedia-thumbnail-cell__img" />
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

  protected readonly _vm = computed<MultimediaVM | undefined>(() =>
    this.multimediaOrchestrator.getOne(this.row().uuid)()
  );

  protected readonly _icon = computed(() => MEDIA_TYPE_ICONS[this._vm()?.mediaType ?? ''] ?? '@tui.file');

  protected onPreviewClick(): void {
    if (!this._vm()) return;
    console.log('Preview', this.row().uuid);
  }
}
