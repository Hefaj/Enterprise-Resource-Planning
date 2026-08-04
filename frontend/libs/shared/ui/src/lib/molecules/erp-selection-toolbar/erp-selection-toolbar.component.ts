import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon } from '@taiga-ui/core';
import { SHARED_KEYS } from '../../translation/keys';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'erp-selection-toolbar',
  standalone: true,
  imports: [CommonModule, TuiIcon, TranslocoModule],
  template: `
    <div class="erp-selection-toolbar" [class.erp-selection-toolbar--active]="active()">
      <div class="erp-selection-toolbar__info">
        <tui-icon icon="@tui.check-square" class="erp-selection-toolbar__icon" />
        <span class="erp-selection-toolbar__text">
          {{ translationKey() | transloco:{ count: count() } }}
        </span>
      </div>
      <div class="erp-selection-toolbar__actions">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--tui-background-base);
      border-bottom: 1px solid var(--tui-border-normal);
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      border-radius: 0.5rem;
    }
    .erp-selection-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      background: var(--tui-background-base);
      border-bottom: 1px solid var(--tui-border-normal);
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      transition: background-color 0.3s ease, border-color 0.3s ease;
    }
    .erp-selection-toolbar--active {
      background: var(--tui-background-accent-1, var(--tui-background-elevation-1)); 
      border-color: var(--tui-background-accent-1, var(--tui-border-focus));
    }
    .erp-selection-toolbar--active .erp-selection-toolbar__icon {
      color: var(--tui-text-action);
    }
    .erp-selection-toolbar__icon {
      color: var(--tui-text-secondary);
      font-size: 1.25rem;
      transition: color 0.3s ease;
    }
    .erp-selection-toolbar__info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--tui-text-primary);
      font-weight: 500;
    }
    .erp-selection-toolbar__icon {
      color: var(--tui-text-action);
      font-size: 1.25rem;
    }
    .erp-selection-toolbar__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpSelectionToolbarComponent {
  public readonly count = input.required<number>();
  public readonly active = input<boolean>(false);
  public readonly translationKey = input<string>(SHARED_KEYS.selectionToolbar.selected);
  
  protected readonly SHARED_KEYS = SHARED_KEYS;
}
