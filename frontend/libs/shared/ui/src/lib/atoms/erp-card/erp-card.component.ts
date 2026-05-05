import { ChangeDetectionStrategy, Component, input, TemplateRef, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ErpCardBuilder } from './erp-card.builder';

export { ErpCardBuilder };

export interface ErpCardConfig {
  header?: string;
  title?: string;
  subtitle?: string;
  styleClass?: string;
  contentStyleClass?: string;
  contentComponent?: Type<any>;
  contentConfig?: any;
  footerComponent?: Type<any>;
  footerConfig?: any;
  headerComponent?: Type<any>;
  headerConfig?: any;
}

@Component({
  selector: 'erp-card',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    @let _config = config();
    <p-card 
      [header]="_config?.header || ''" 
      [subheader]="_config?.subtitle || ''"
      [styleClass]="(_config?.styleClass || '') + ' shadow-sm border border-surface-200 dark:border-surface-800 rounded-2xl overflow-hidden bg-surface-0 dark:bg-surface-900'"
    >
      <ng-template #title>
        @if (_config?.title) {
          <div class="text-xl font-bold text-surface-900 dark:text-surface-0">{{ _config?.title }}</div>
        }
      </ng-template>

      <!-- Main Content -->
      <div [class]="(_config?.contentStyleClass || '') + ' text-surface-600 dark:text-surface-400'">
        @if (_config?.contentComponent) {
          <ng-container 
            *ngComponentOutlet="_config!.contentComponent!; inputs: { ..._config!.contentConfig, tabValue: tabValue() }" 
          />
        }
        <ng-content></ng-content>
      </div>

      <!-- Footer -->
      <ng-template #footer>
        <div class="pt-4 border-t border-surface-100 dark:border-surface-800">
          @if (_config?.footerComponent) {
            <ng-container 
              *ngComponentOutlet="_config!.footerComponent!; inputs: { ..._config!.footerConfig, tabValue: tabValue() }" 
            />
          }
          <ng-content select="[footer]"></ng-content>
        </div>
      </ng-template>

      <!-- Custom Header Template -->
      <ng-template #header>
        @if (_config?.headerComponent) {
          <ng-container 
            *ngComponentOutlet="_config!.headerComponent!; inputs: { ..._config!.headerConfig, tabValue: tabValue() }" 
          />
        }
        <ng-content select="[header]"></ng-content>
      </ng-template>
    </p-card>
  `,
  styles: [`
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpCardComponent {
  public config = input<ErpCardConfig>({});
  public tabValue = input<string | number>();
}
