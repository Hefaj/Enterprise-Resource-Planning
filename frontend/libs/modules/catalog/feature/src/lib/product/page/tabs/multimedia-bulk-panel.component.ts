import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon, TuiButton } from '@taiga-ui/core';
import { PRODUCT_KEYS } from '../../translation/keys';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'erp-multimedia-bulk-panel',
  standalone: true,
  imports: [CommonModule, TuiIcon, TuiButton, ErpTranslatePipe, TranslocoModule],
  template: `
    <div class="erp-bulk-panel">
      <div class="erp-bulk-panel__icon-wrapper">
        <tui-icon icon="@tui.layers" class="erp-bulk-panel__icon" />
      </div>
      
      <ng-container *transloco="let t; read: 'product.base.multimedia.panel'">
        <h3 class="erp-bulk-panel__title">{{ t('bulkTitle', { count: count() }) }}</h3>
        <p class="erp-bulk-panel__description">
          {{ t('bulkDescription') }}
        </p>
      </ng-container>

      <div class="erp-bulk-panel__actions">
        <button tuiButton type="button" appearance="primary" (click)="onAddMass()">
          <tui-icon icon="@tui.plus" />
          {{ (PRODUCT_KEYS.base.multimedia.panel.bulkAdd | erpTranslate) || '' }}
        </button>
        <button tuiButton type="button" appearance="destructive" (click)="onDeleteMass()">
          <tui-icon icon="@tui.trash" />
          {{ (PRODUCT_KEYS.base.multimedia.panel.bulkDelete | erpTranslate) || '' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
      min-height: 400px;
    }

    .erp-bulk-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      max-width: 400px;
      padding: 2rem;
      border: 1px dashed var(--tui-border-normal);
      border-radius: 1rem;
      background: var(--tui-background-base);
    }

    .erp-bulk-panel__icon-wrapper {
      width: 4rem;
      height: 4rem;
      border-radius: 50%;
      background: var(--tui-background-neutral-1);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.5rem;
    }

    .erp-bulk-panel__icon {
      font-size: 2rem;
      color: var(--tui-text-secondary);
    }

    .erp-bulk-panel__title {
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--tui-text-primary);
    }

    .erp-bulk-panel__description {
      margin: 0 0 2rem;
      color: var(--tui-text-secondary);
      line-height: 1.5;
    }

    .erp-bulk-panel__actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
    }

    .erp-bulk-panel__actions > button {
      width: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimediaBulkPanelComponent {
  /** Ilość wybranych produktów. */
  public readonly count = input.required<number>();

  protected readonly PRODUCT_KEYS = PRODUCT_KEYS;

  protected onAddMass(): void {
    console.log('Masowe dodawanie multimediów dla', this.count(), 'produktów');
  }

  protected onDeleteMass(): void {
    console.log('Masowe usuwanie multimediów dla', this.count(), 'produktów');
  }
}

