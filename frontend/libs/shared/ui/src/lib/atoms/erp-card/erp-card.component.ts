import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ErpCardConfig } from './erp-card.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-card',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    @let _header = headerLabel();
    @let _title = titleText();
    @let _subtitle = subtitle();
    @let _styleClass = styleClass();
    @let _contentStyleClass = contentStyleClass();

    <p-card
      [header]="_header || ''"
      [subheader]="_subtitle || ''"
      [styleClass]="(_styleClass || '') + ' shadow-sm border border-surface-200 dark:border-surface-800 rounded-2xl overflow-hidden bg-surface-0 dark:bg-surface-900'"
    >
      <ng-template #title>
        @if (_title) {
          <div class="text-xl font-bold text-surface-900 dark:text-surface-0">{{ _title }}</div>
        }
      </ng-template>

      <!-- Main Content -->
      <div [class]="(_contentStyleClass || '') + ' text-surface-600 dark:text-surface-400'">
        @if (config().contentComponent) {
          <ng-container *ngComponentOutlet="config().contentComponent!; inputs: config().contentConfig" />
        }
        <ng-content></ng-content>
      </div>

      <!-- Footer -->
      <ng-template #footer>
        <div class="pt-4 border-t border-surface-100 dark:border-surface-800">
          @if (config().footerComponent) {
            <ng-container *ngComponentOutlet="config().footerComponent!; inputs: config().footerConfig" />
          }
          <ng-content select="[footer]"></ng-content>
        </div>
      </ng-template>

      <!-- Custom Header Template -->
      <ng-template #header>
        @if (config().headerComponent) {
          <ng-container *ngComponentOutlet="config().headerComponent!; inputs: config().headerConfig" />
        }
        <ng-content select="[header]"></ng-content>
      </ng-template>
    </p-card>
  `,
  styles: [
    `
      :host ::ng-deep .p-card {
        background: transparent !important;
        color: inherit !important;
        box-shadow: none !important;
      }
      :host ::ng-deep .p-card-body {
        padding: 1.5rem;
      }
      :host ::ng-deep .p-card-title {
        margin-bottom: 0.25rem;
        font-size: 1.25rem;
        font-weight: 700;
      }
      :host ::ng-deep .p-card-subtitle {
        color: var(--p-surface-500);
        font-weight: 500;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpCardComponent {
  public config = input.required<ErpCardConfig>();

  protected headerLabel = computed(() => unwrapSignal(this.config().header));
  protected titleText = computed(() => unwrapSignal(this.config().title));
  protected subtitle = computed(() => unwrapSignal(this.config().subtitle));
  protected styleClass = computed(() => unwrapSignal(this.config().styleClass));
  protected contentStyleClass = computed(() => unwrapSignal(this.config().contentStyleClass));
}
