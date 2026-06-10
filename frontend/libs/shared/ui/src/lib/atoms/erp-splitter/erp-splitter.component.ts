import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgComponentOutlet, NgStyle } from '@angular/common';
import { SplitterModule } from 'primeng/splitter';
import { ErpSplitterConfig } from './erp-splitter.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-splitter',
  standalone: true,
  imports: [NgComponentOutlet, NgStyle, SplitterModule],
  template: `
    @let _layout = layout();
    @let _gutterSize = gutterSize();
    @let _style = style();
    @let _styleClass = styleClass();
    @let _panelSizes = panelSizes();
    @let _minSizes = minSizes();
    @let _panels = unwrappedPanels();

    @if (_panels.length > 0) {
      <p-splitter
        [layout]="_layout || 'horizontal'"
        [gutterSize]="_gutterSize !== undefined ? _gutterSize : 4"
        [style]="_style"
        [styleClass]="_styleClass"
        [panelSizes]="_panelSizes"
        [minSizes]="_minSizes"
      >
        @for (panel of _panels; track $index) {
          <ng-template #panel>
            <div
              [class]="panel.styleClass"
              [ngStyle]="panel.style"
              style="width: 100%; height: 100%; display: flex; flex-direction: column;"
            >
              @if (panel.component) {
                <ng-container *ngComponentOutlet="panel.component; inputs: panel.config" />
              }
            </div>
          </ng-template>
        }
      </p-splitter>
    } @else {
      <div class="flex flex-col items-center justify-center p-8 border border-dashed border-slate-300 text-slate-400 rounded-lg">
        <i class="pi pi-columns text-3xl mb-2"></i>
        <span class="text-sm font-medium">Splitter - Brak paneli</span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }
      :host ::ng-deep .p-splitter {
        border: 1px solid var(--p-surface-200);
        background: var(--p-surface-0);
        border-radius: 0.5rem;
        transition: border-color 0.2s, background-color 0.2s;
      }
      :host-context(.dark) ::ng-deep .p-splitter {
        border-color: var(--p-surface-800);
        background: var(--p-surface-950);
      }
      :host ::ng-deep .p-splitter-gutter {
        background: var(--p-surface-200) !important;
        transition: background-color 0.2s;
      }
      :host-context(.dark) ::ng-deep .p-splitter-gutter {
        background: var(--p-surface-800) !important;
      }
      :host ::ng-deep .p-splitter-gutter-handle {
        background: var(--p-surface-400) !important;
        border-radius: 9999px;
      }
      :host-context(.dark) ::ng-deep .p-splitter-gutter-handle {
        background: var(--p-surface-600) !important;
      }
      :host ::ng-deep .p-splitter-gutter:hover {
        background: var(--p-primary-color) !important;
      }
      :host ::ng-deep .p-splitter .p-splitter {
        border: none !important;
        border-radius: 0 !important;
        background: transparent !important;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpSplitterComponent {
  public config = input.required<ErpSplitterConfig>();
  public internalLoading = signal(false);

  protected layout = computed(() => unwrapSignal(this.config().layout));
  protected gutterSize = computed(() => unwrapSignal(this.config().gutterSize));
  protected style = computed(() => {
    const customStyle = unwrapSignal(this.config().style) || {};
    return {
      height: '100%',
      width: '100%',
      ...customStyle
    };
  });
  protected styleClass = computed(() => unwrapSignal(this.config().styleClass));

  protected unwrappedPanels = computed(() => {
    const rawPanels = unwrapSignal(this.config().panels) || [];
    return rawPanels.map((panel) => {
      const comp = unwrapSignal(panel.component);
      const rawConfig = unwrapSignal(panel.config);

      let resolvedConfig = rawConfig;
      if (comp && rawConfig !== undefined && rawConfig !== null) {
        if (typeof rawConfig !== 'object' || !('config' in rawConfig)) {
          resolvedConfig = { config: rawConfig };
        }
      }

      return {
        ...panel,
        size: unwrapSignal(panel.size),
        minSize: unwrapSignal(panel.minSize),
        component: comp,
        config: resolvedConfig,
        styleClass: unwrapSignal(panel.styleClass),
        style: unwrapSignal(panel.style),
      };
    });
  });

  protected panelSizes = computed(() => {
    const explicitSizes = unwrapSignal(this.config().panelSizes);
    if (explicitSizes && explicitSizes.length > 0) {
      return explicitSizes;
    }
    const panels = this.unwrappedPanels();
    return panels.map((p) => p.size ?? 100 / panels.length);
  });

  protected minSizes = computed(() => {
    const explicitMinSizes = unwrapSignal(this.config().minSizes);
    if (explicitMinSizes && explicitMinSizes.length > 0) {
      return explicitMinSizes;
    }
    const panels = this.unwrappedPanels();
    return panels.map((p) => p.minSize ?? 0);
  });
}
