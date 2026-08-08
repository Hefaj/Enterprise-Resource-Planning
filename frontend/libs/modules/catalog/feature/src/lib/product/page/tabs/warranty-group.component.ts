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
import { ErpGroupCardBuilder, ErpGroupCardComponent, ErpTableBuilder, ErpTableComponent } from '@erp/shared/ui';
import { CatalogProductOrchestrator, ProductVM, WarrantyVM } from '@erp/catalog/data-access';
import { PRODUCT_KEYS } from '../../translation/keys';

/**
 * Pojedyncza grupa gwarancji jednego produktu — nagłówek (ErpGroupCard)
 * + tabela gwarancji tego produktu (ErpTable).
 */
@Component({
  selector: 'erp-warranty-group',
  standalone: true,
  imports: [ErpGroupCardComponent, ErpTableComponent],
  template: `
    <erp-group-card [config]="cardConfig">
      <erp-table class="block w-full" [config]="tableConfig" />
    </erp-group-card>
  `,
  styles: [`
    :host {
      display: block;
      padding: 0.5rem 0; /* Padding for virtual scroll separation */
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarrantyGroupComponent implements OnInit {
  /** Produkt dla którego wyświetlamy grupę. */
  public readonly product = input.required<ProductVM>();

  /** Funkcja mierząca element z TanStack Virtual. */
  public readonly measureElement = input<((element: any) => void) | undefined>();

  private readonly elRef = inject(ElementRef);
  private readonly productOrchestrator = inject(CatalogProductOrchestrator);

  /** Signal z gwarancjami dla tego konkretnego produktu. */
  protected readonly _warranties = computed(() => this.product().warranties || []);

  protected readonly cardConfig = ErpGroupCardBuilder.create((b) =>
    b
      .setTitle(computed(() => this.product().name))
      .setSubtitle(computed(() => this.product().sku))
      .setIcon('@tui.shield-check')
      .setLoading(computed(() => this._warranties().length === 0 && this.productOrchestrator.isLoading()))
      .setOnToggle(() => this.triggerMeasure())
      .addAction({
        label: PRODUCT_KEYS.base.warranty.panel.addWarranty,
        icon: '@tui.plus',
        onClick: () => console.log('Dodaj gwarancję do', this.product().uuid),
      })
  );

  protected readonly tableConfig = ErpTableBuilder.create<ErpTableBuilder<WarrantyVM>>((table) => {
    table
      .setMode('client')
      .setDefaultPageSize(50)
      .setItems(this._warranties)
      .setItemCount(computed(() => this._warranties().length))
      .setEmptyMessage(PRODUCT_KEYS.base.warranty.panel.emptyProduct)
      .addColumn((c) => c
        .setId('name')
        .setAccessorKey('name')
        .setHeader('Nazwa gwarancji')
        .setSize(220)
      )
      .addColumn((c) => c
        .setId('durationMonths')
        .setAccessorKey('durationMonths')
        .setHeader('Okres (mc)')
        .setCellClass('text-right')
        .setSize(110)
      )
      .addColumn((c) => c
        .setId('description')
        .setAccessorKey('description')
        .setHeader('Opis')
        .setSize(400)
      );
  });

  constructor() {
    // Kiedy gwarancje się załadują lub zmienią, musimy powiadomić virtualizer
    // o ewentualnej zmianie wysokości (measureElement).
    effect(() => {
      this._warranties();
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
}
