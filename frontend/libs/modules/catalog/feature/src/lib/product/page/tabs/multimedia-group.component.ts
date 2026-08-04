import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  effect,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpGroupCardBuilder, ErpGroupCardComponent } from '@erp/shared/ui';
import { ErpMediaThumbnailBuilder, ErpMediaThumbnailComponent } from '@erp/catalog/ui';
import { CatalogProductOrchestrator, ProductVM } from '@erp/catalog/data-access';
import { PRODUCT_KEYS } from '../../translation/keys';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { ProductListViewStore } from '../product-list-view.store';

@Component({
  selector: 'erp-multimedia-group',
  standalone: true,
  imports: [CommonModule, ErpGroupCardComponent, ErpMediaThumbnailComponent, ErpTranslatePipe],
  template: `
    <erp-group-card [config]="cardConfig">
      <div class="erp-multimedia-group__grid">
        @for (media of _media(); track media.uuid) {
          <erp-media-thumbnail [config]="buildThumbnailConfig(media)" />
        }
        @if (_media().length === 0) {
          <div class="erp-multimedia-group__empty">
            {{ (PRODUCT_KEYS.base.multimedia.panel.emptyProduct | erpTranslate) || '' }}
          </div>
        }
      </div>
    </erp-group-card>
  `,
  styles: [`
    :host {
      display: block;
      padding: 0.5rem 0; /* Padding for virtual scroll separation */
    }

    .erp-multimedia-group__grid {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .erp-multimedia-group__empty {
      padding: 2rem;
      text-align: center;
      color: var(--tui-text-secondary);
      width: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimediaGroupComponent implements OnInit {
  /** Produkt dla którego wyświetlamy grupę. */
  public readonly product = input.required<ProductVM>();
  
  /** Funkcja mierząca element z TanStack Virtual. */
  public readonly measureElement = input<((element: any) => void) | undefined>();

  private readonly store = inject(ProductListViewStore);
  private readonly elRef = inject(ElementRef);
  private readonly productOrchestrator = inject(CatalogProductOrchestrator);

  protected readonly PRODUCT_KEYS = PRODUCT_KEYS;

  /** Signal z multimediami dla tego konkretnego produktu. */
  protected readonly _media = computed(() => {
    return this.product().multimedia || [];
  });

  /** Konfiguracja dla ErpGroupCard. */
  protected readonly cardConfig = ErpGroupCardBuilder.create((b) =>
    b
      .setTitle(computed(() => this.product().name))
      .setSubtitle(computed(() => this.product().sku))
      .setIcon('@tui.package')
      .setLoading(computed(() => this._media().length === 0 && this.productOrchestrator.isLoading()))
      // Animujemy rozwinięcie, card zamyka się / otwiera
      .setOnToggle(() => this.triggerMeasure())
      // Przykładowe akcje dla grupy
      .addAction({
        label: PRODUCT_KEYS.base.multimedia.actions.addFile,
        icon: '@tui.plus',
        onClick: () => console.log('Dodaj plik do', this.product().uuid)
      })
  );

  constructor() {
    // Kiedy multimedia się załadują lub zmienią, musimy powiadomić virtualizer 
    // o ewentualnej zmianie wysokości (measureElement).
    effect(() => {
      this._media();
      // setTimeout by pozwolić DOM się zaktualizować po zmianie signala
      setTimeout(() => this.triggerMeasure(), 0);
    });
  }

  ngOnInit(): void {
    this.triggerMeasure();
  }

  private triggerMeasure(): void {
    const measureFn = this.measureElement();
    if (measureFn) {
      measureFn(this.elRef.nativeElement);
    }
  }

  protected buildThumbnailConfig(media: any) {
    return new ErpMediaThumbnailBuilder(media.uuid)
      .setFileName(media.fileName)
      .setMediaType(media.mediaType)
      .setThumbnailUrl(media.thumbnailUrl)
      .setFileSize(media.fileSize)
      .setSelected(computed(() => this.store.selectedMultimedia().has(media.uuid)))
      .setOnSelect((uuid, selected, shiftKey) => this.store.toggleMultimediaSelection(
        uuid, 
        selected, 
        shiftKey, 
        this._media().map((m: any) => m.uuid)
      ))
      .setOnPreview((uuid) => console.log('Preview', uuid))
      .addAction({
        label: PRODUCT_KEYS.base.multimedia.actions.remove,
        icon: '@tui.trash',
        onClick: (uuid) => console.log('Usuń', uuid)
      })
      .build();
  }
}
