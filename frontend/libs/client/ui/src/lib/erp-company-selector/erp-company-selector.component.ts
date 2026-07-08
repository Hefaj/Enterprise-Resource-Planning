import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TuiButton, TuiDropdown, TuiDataList, TuiIcon } from '@taiga-ui/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erp-company-selector',
  standalone: true,
  imports: [
    CommonModule,
    TuiButton,
    TuiDropdown,
    TuiDataList,
    TuiIcon
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      tuiButton
      type="button"
      appearance="outline"
      iconStart="@tui.briefcase"
      iconEnd="@tui.chevron-down"
      tuiDropdownAuto
      [tuiDropdown]="companyDropdown"
      class="company-selector"
    >
      {{ currentCompany() }}
    </button>

    <ng-template #companyDropdown let-close>
      <tui-data-list>
        @for (company of companies(); track company) {
          <button
            tuiOption
            type="button"
            (click)="onSelectCompany(company); close()"
          >
            {{ company }}
            @if (company === currentCompany()) {
              <tui-icon icon="@tui.check" class="company-selector__check" />
            }
          </button>
        }
      </tui-data-list>
    </ng-template>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    .company-selector {
      border: 1px solid var(--tui-border-normal) !important;
      background: var(--tui-background-neutral-1) !important;
      color: var(--tui-text-primary) !important;
      font-weight: 600 !important;
      border-radius: var(--tui-radius-m) !important;
      height: 2.5rem !important;
      font-size: 0.875rem !important;
      cursor: pointer;
      display: flex !important;
      align-items: center !important;
      padding: 0 0.875rem !important;
      transition: all 0.2s;
    }
    .company-selector:hover {
      background: var(--tui-background-neutral-1-hover) !important;
    }
    .company-selector__check {
      margin-inline-start: 0.5rem;
      color: var(--tui-text-action);
    }
  `]
})
export class ErpCompanySelectorComponent {
  public readonly currentCompany = input.required<string>();
  public readonly companies = input.required<string[]>();
  public readonly companyChange = output<string>();

  protected onSelectCompany(company: string): void {
    this.companyChange.emit(company);
  }
}
