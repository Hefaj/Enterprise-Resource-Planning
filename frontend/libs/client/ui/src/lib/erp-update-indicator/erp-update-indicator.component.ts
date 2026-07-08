import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erp-update-indicator',
  standalone: true,
  imports: [
    CommonModule,
    TuiButton,
    TuiIcon,
    ErpTranslatePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (updateAvailable()) {
      <button
        tuiIconButton
        type="button"
        appearance="flat"
        size="m"
        [title]="'Wersja aplikacji: dostępna aktualizacja!' | erpTranslate"
        (click)="onUpdate()"
        class="update-indicator"
      >
        <tui-icon icon="@tui.arrow-up-circle" />
        <span class="update-indicator__badge"></span>
      </button>
    }
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(226, 137, 0, 0.7);
      }
      70% {
        box-shadow: 0 0 0 8px rgba(226, 137, 0, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(226, 137, 0, 0);
      }
    }
    .update-indicator {
      position: relative;
      color: var(--tui-text-warning) !important;
      border-radius: var(--tui-radius-m) !important;
      border: 1px solid var(--tui-border-normal) !important;
      background: var(--tui-background-neutral-1) !important;
      width: 2.5rem !important;
      height: 2.5rem !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer;
      transition: all 0.2s;
    }
    .update-indicator:hover {
      background: var(--tui-background-neutral-1-hover) !important;
    }
    .update-indicator__badge {
      position: absolute;
      top: 0.35rem;
      right: 0.35rem;
      width: 0.45rem;
      height: 0.45rem;
      background: var(--tui-support-warning);
      border-radius: 50%;
      border: 1px solid var(--tui-background-neutral-2);
      animation: pulse 2s infinite;
    }
  `]
})
export class ErpUpdateIndicatorComponent {
  public readonly updateAvailable = input.required<boolean>();
  public readonly updateClick = output<void>();

  protected onUpdate(): void {
    this.updateClick.emit();
  }
}
