import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpSplitterComponent, ErpSplitterBuilder } from '@erp/shared/ui/erp-splitter';
import { ErpEmptyCardComponent, ErpEmptyCardBuilder } from '@erp/shared/ui/erp-empty-card';

@Component({
  selector: 'erp-product-tab',
  standalone: true,
  imports: [CommonModule, ErpSplitterComponent],
  template: `
    <div class="tab-container">
      <div class="demo-card">
        <div class="demo-header">
          <div>
            <h3 class="demo-title">Demo: Nowy komponent Splitter</h3>
            <p class="demo-desc">Zagnieżdżona struktura paneli skonfigurowana za pomocą ErpSplitterBuilder.</p>
          </div>
          <span class="demo-badge">erp-splitter</span>
        </div>

        <div class="splitter-demo-wrapper">
          <erp-splitter [config]="splitterConfig" />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .tab-container {
        padding: 1rem 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
      }
      .demo-card {
        border: 1px solid var(--p-content-border-color);
        border-radius: 0.75rem;
        padding: 1.5rem;
        background-color: var(--p-content-background);
        color: var(--p-text-color);
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
        display: flex;
        flex-direction: column;
        flex: 1;
        gap: 1rem;
        overflow: hidden;
      }
      .demo-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .demo-title {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--p-text-color);
      }
      .demo-desc {
        margin: 0.25rem 0 0 0;
        font-size: 0.875rem;
        color: var(--p-text-muted-color);
      }
      .demo-badge {
        padding: 0.25rem 0.75rem;
        background-color: var(--p-primary-50);
        color: var(--p-primary-700);
        font-size: 0.75rem;
        font-weight: 600;
        border-radius: 9999px;
        border: 1px solid var(--p-primary-200);
      }
      :host-context(.dark) .demo-badge {
        background-color: rgba(var(--p-primary-rgb), 0.1);
        color: var(--p-primary-400);
        border-color: rgba(var(--p-primary-rgb), 0.2);
      }
      .splitter-demo-wrapper {
        margin-top: 1rem;
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTabComponent {
  protected readonly splitterConfig = ErpSplitterBuilder.create((b) =>
    b
      .setStyle({ height: '100%' })
      .setPanelSizes([20, 80])
      .setMinSizes([10, 0])
      .addPanel({
        component: ErpEmptyCardComponent,
        config: ErpEmptyCardBuilder.create((eb1) =>
          eb1
            .setTitle('Panel 1')
            .setIcon('pi pi-chart-bar')
            .setDescription('Karta pusta Panelu 1. Skonfiguruj dane w ErpEmptyCard.')
            .setShowPulse(true)
        ),
      })
      .addPanel({
        component: ErpSplitterComponent,
        config: ErpSplitterBuilder.create((b2) =>
          b2
            .setLayout('vertical')
            .setPanelSizes([50, 50])
            .addPanel({
              component: ErpEmptyCardComponent,
              config: ErpEmptyCardBuilder.create((eb2) =>
                eb2
                  .setTitle('Panel 2')
                  .setIcon('pi pi-map')
                  .setDescription('Karta pusta Panelu 2. Wypełnij ją odpowiednim komponentem.')
                  .setShowPulse(true)
              ),
            })
            .addPanel({
              component: ErpSplitterComponent,
              config: ErpSplitterBuilder.create((b3) =>
                b3
                  .setPanelSizes([30, 70])
                  .addPanel({
                    component: ErpEmptyCardComponent,
                    config: ErpEmptyCardBuilder.create((eb3) =>
                      eb3
                        .setTitle('Panel 3')
                        .setIcon('pi pi-cog')
                        .setDescription('Karta pusta Panelu 3.')
                        .setShowPulse(false)
                    ),
                  })
                  .addPanel({
                    component: ErpEmptyCardComponent,
                    config: ErpEmptyCardBuilder.create((eb4) =>
                      eb4
                        .setTitle('Panel 4')
                        .setIcon('pi pi-shield')
                        .setDescription('Karta pusta Panelu 4.')
                        .setShowPulse(true)
                    ),
                  }),
              ),
            }),
        ),
      }),
  );
}
