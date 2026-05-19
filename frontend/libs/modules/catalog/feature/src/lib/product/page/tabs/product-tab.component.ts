import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpSplitterComponent, ErpSplitterBuilder } from '@erp/shared/ui/erp-splitter';

@Component({
  selector: 'demo-panel-1',
  standalone: true,
  template: `<div style="display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; background-color: #f8fafc; color: #475569; font-weight: 500;">Panel 1</div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoPanel1Component {}

@Component({
  selector: 'demo-panel-2',
  standalone: true,
  template: `<div style="display: flex; flex-grow: 1; height: 100%; align-items: center; justify-content: center; background-color: #f1f5f9; color: #475569; font-weight: 500;">Panel 2</div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoPanel2Component {}

@Component({
  selector: 'demo-panel-3',
  standalone: true,
  template: `<div style="display: flex; height: 100%; align-items: center; justify-content: center; background-color: #e2e8f0; color: #475569; font-weight: 500;">Panel 3</div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoPanel3Component {}

@Component({
  selector: 'demo-panel-4',
  standalone: true,
  template: `<div style="display: flex; height: 100%; align-items: center; justify-content: center; background-color: #cbd5e1; color: #475569; font-weight: 500;">Panel 4</div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoPanel4Component {}

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
        box-sizing: border-box;
      }
      .demo-card {
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 1.5rem;
        background-color: #ffffff;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .demo-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .demo-title {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 500;
        color: #0f172a;
      }
      .demo-desc {
        margin: 0.25rem 0 0 0;
        font-size: 0.875rem;
        color: #64748b;
      }
      .demo-badge {
        padding: 0.25rem 0.75rem;
        background-color: #f0fdfa;
        color: #0f766e;
        font-size: 0.75rem;
        font-weight: 600;
        border-radius: 9999px;
        border: 1px solid #ccfbf1;
      }
      .splitter-demo-wrapper {
        margin-top: 1rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        overflow: hidden;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTabComponent {
  protected readonly splitterConfig = ErpSplitterBuilder.create((b) =>
    b
      .setStyle({ height: '300px' })
      .setPanelSizes([20, 80])
      .setMinSizes([10, 0])
      .addPanel({
        component: DemoPanel1Component,
      })
      .addPanel({
        component: ErpSplitterComponent,
        config: ErpSplitterBuilder.create((b2) =>
          b2
            .setLayout('vertical')
            .setPanelSizes([50, 50])
            .addPanel({
              component: DemoPanel2Component,
            })
            .addPanel({
              component: ErpSplitterComponent,
              config: ErpSplitterBuilder.create((b3) =>
                b3
                  .setPanelSizes([20, 80])
                  .addPanel({
                    component: DemoPanel3Component,
                  })
                  .addPanel({
                    component: DemoPanel4Component,
                  })
              ),
            })
        ),
      })
  );
}
