import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { TuiDialogContext, TuiIcon, TuiLoader } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { ErpButtonComponent } from '../erp-button/erp-button.component';
import { ErpButtonConfig } from '../erp-button/erp-button.types';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { SHARED_KEYS } from '../../translation';
import { ErpMediaPreviewConfig, ErpMediaPreviewItem } from './erp-media-preview.types';

/**
 * Okno podglądu pliku — komponent czysto prezentacyjny, otwierany przez
 * `ErpMediaPreviewService`.
 *
 * <b>Dlaczego to nie jest modal z `ErpModalService`.</b> Tamten mechanizm opisuje modale
 * komendowe: kroki, walidacja, `setOnSave` wołające orkiestrator (patrz docs/guides/frontend/modals.md).
 * Podgląd nic nie zapisuje i nie ma komendy, którą miałby nieść — założenie mu jej na siłę
 * dołożyłoby pusty krok i przycisk zapisu, który nic nie robi. To jest okno przeglądarki treści
 * i dlatego idzie tą samą drogą co `ErpConfirmDialogService`: `TuiDialogService` +
 * Polymorpheus.
 *
 * <b>Nie deklaruje providerów Transloco</b> — przesłoniłyby scope modułu, z którego okno
 * otwarto (docs/guides/frontend/translations.md §2).
 */
@Component({
  selector: 'erp-media-preview',
  standalone: true,
  imports: [TuiIcon, TuiLoader, ErpButtonComponent, ErpTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview">
      <header class="preview__head">
        <div class="preview__id">
          <h2 class="preview__name" [title]="_current()?.fileName ?? ''">{{ _current()?.fileName }}</h2>
          @if (_caption()) {
            <p class="preview__caption">{{ _caption() }}</p>
          }
        </div>

        <div class="preview__tools">
          @if (_total() > 1) {
            <span class="preview__counter">{{ _counter() | erpTranslate }}</span>
          }
          @if (_downloadButton(); as button) {
            <erp-button [config]="button" />
          }
          <erp-button [config]="_closeButton()" />
        </div>
      </header>

      <div class="preview__stage">
        @if (_total() > 1) {
          <button
            type="button"
            class="preview__nav preview__nav--prev"
            [disabled]="_index() === 0"
            [attr.aria-label]="SHARED_KEYS.mediaPreview.previous | erpTranslate"
            (click)="onPrevious()"
          >
            <tui-icon icon="@tui.chevron-left" />
          </button>
        }

        <div class="preview__canvas">
          @if (!_renderable()) {
            <div class="preview__fallback">
              <tui-icon [icon]="_current()?.icon ?? '@tui.file'" class="preview__fallback-icon" />
              <p>{{ _unavailable() | erpTranslate }}</p>
            </div>
          } @else if (_url(); as url) {
            <!-- Opis alternatywny bierze nazwę pliku — to jedyny opis, jaki system o tym obrazie ma. -->
            <img [src]="url" [alt]="_current()?.fileName ?? ''" class="preview__img" />
          } @else {
            <tui-loader [loading]="true" size="l" [inheritColor]="true" />
          }
        </div>

        @if (_total() > 1) {
          <button
            type="button"
            class="preview__nav preview__nav--next"
            [disabled]="_index() >= _total() - 1"
            [attr.aria-label]="SHARED_KEYS.mediaPreview.next | erpTranslate"
            (click)="onNext()"
          >
            <tui-icon icon="@tui.chevron-right" />
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .preview {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        block-size: min(78vh, 52rem);
      }

      .preview__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      .preview__id {
        min-inline-size: 0;
      }

      .preview__name {
        margin: 0;
        font: var(--tui-font-heading-6);
        color: var(--tui-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .preview__caption {
        margin: 0;
        font: var(--tui-font-text-s);
        color: var(--tui-text-secondary);
      }

      .preview__tools {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
      }

      .preview__counter {
        font: var(--tui-font-text-s);
        color: var(--tui-text-secondary);
        white-space: nowrap;
      }

      .preview__stage {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-block-size: 0;
      }

      .preview__canvas {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        min-inline-size: 0;
        block-size: 100%;
        background: var(--tui-background-base-alt);
        border-radius: 0.5rem;
        overflow: hidden;
      }

      .preview__img {
        max-inline-size: 100%;
        max-block-size: 100%;
        object-fit: contain;
        /* Szachownica pod samym obrazem, a nie pod całym płótnem: bez niej PNG z przezroczystością
           wygląda jak obraz z tłem w kolorze motywu, a to jest różnica, którą użytkownik ogląda
           właśnie po to, żeby ją zobaczyć. Pod płótnem rysowałaby się także obok zdjęcia
           nieprzezroczystego, gdzie niczego nie wyjaśnia i tylko hałasuje. */
        background:
          repeating-conic-gradient(var(--tui-background-neutral-1) 0% 25%, transparent 0% 50%) 50% / 1.5rem 1.5rem;
      }

      .preview__fallback {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        color: var(--tui-text-secondary);
        font: var(--tui-font-text-m);
      }

      .preview__fallback-icon {
        font-size: 3rem;
      }

      .preview__nav {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        inline-size: 2.5rem;
        block-size: 2.5rem;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        background: var(--tui-background-neutral-1);
        color: var(--tui-text-primary);
      }

      .preview__nav:hover:not(:disabled) {
        background: var(--tui-background-neutral-2);
      }

      .preview__nav:disabled {
        opacity: 0.4;
        cursor: default;
      }
    `,
  ],
})
export class ErpMediaPreviewComponent {
  private readonly _context =
    inject<TuiDialogContext<void, ErpMediaPreviewConfig>>(POLYMORPHEUS_CONTEXT);

  protected readonly SHARED_KEYS = SHARED_KEYS;

  /** Pobieranie w toku — blokuje przycisk, żeby jedno kliknięcie nie stało się pięcioma. */
  private readonly _downloading = signal(false);

  protected readonly _items = computed<readonly ErpMediaPreviewItem[]>(
    () => unwrapSignal(this._context.data.items) ?? [],
  );

  protected readonly _total = computed(() => this._items().length);

  /**
   * Pozycja startowa jest liczona raz, przy tworzeniu komponentu — potem indeksem steruje
   * już użytkownik. Gdyby był `computed` po `startId`, doładowanie kolejnych wierszy panelu
   * przestawiałoby obraz pod oglądającym.
   */
  private readonly _initialIndex = (() => {
    const startId = this._context.data.startId;
    const index = startId ? this._items().findIndex(item => item.id === startId) : 0;
    return index >= 0 ? index : 0;
  })();

  protected readonly _index = signal(this._initialIndex);

  protected readonly _current = computed<ErpMediaPreviewItem | undefined>(
    () => this._items()[this._index()],
  );

  protected readonly _caption = computed(() => unwrapSignal(this._current()?.caption));

  protected readonly _url = computed(() => unwrapSignal(this._current()?.url));

  /** Domyślnie renderujemy — pozycja musi się jawnie wypisać, żeby dostać ikonę. */
  protected readonly _renderable = computed(() => this._current()?.renderable !== false);

  protected readonly _counter = computed(() => ({
    key: SHARED_KEYS.mediaPreview.counter,
    params: { current: this._index() + 1, total: this._total() },
  }));

  protected readonly _unavailable = computed(
    () => unwrapSignal(this._context.data.unavailableMessage) ?? SHARED_KEYS.mediaPreview.unavailable,
  );

  protected readonly _downloadButton = computed<ErpButtonConfig | undefined>(() => {
    if (!this._context.data.onDownload) {
      return undefined;
    }

    return {
      label: SHARED_KEYS.mediaPreview.download,
      appearance: 'flat',
      iconStart: '@tui.download',
      loading: this._downloading(),
      disabled: this._downloading(),
      fn: () => this._download(),
    };
  });

  protected readonly _closeButton = computed<ErpButtonConfig>(() => ({
    label: SHARED_KEYS.mediaPreview.close,
    appearance: 'flat',
    iconStart: '@tui.x',
    fn: () => this._context.completeWith(),
  }));

  /**
   * Strzałki przewijają galerię. Nasłuch jest na oknie, a nie na hoście, bo focus po otwarciu
   * dialogu siedzi na przycisku zamknięcia — zdarzenie nie doszłoby do kontenera podglądu.
   */
  @HostListener('window:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.onPrevious();
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowRight') {
      this.onNext();
      event.preventDefault();
    }
  }

  /**
   * Bez zawijania na końcach. Galeria produktu jest krótka i uporządkowana; przeskok
   * z ostatniego zdjęcia na pierwsze wygląda wtedy jak zgubienie miejsca, a nie jak nawigacja.
   */
  protected onPrevious(): void {
    this._index.update(index => Math.max(0, index - 1));
  }

  protected onNext(): void {
    this._index.update(index => Math.min(this._total() - 1, index + 1));
  }

  private async _download(): Promise<void> {
    const item = this._current();
    const action = this._context.data.onDownload;

    if (!item || !action || this._downloading()) {
      return;
    }

    this._downloading.set(true);

    try {
      await action(item);
    } finally {
      this._downloading.set(false);
    }
  }
}
