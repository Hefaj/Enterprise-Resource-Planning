import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiItem } from '@taiga-ui/cdk';
import { TuiIcon, TuiLink } from '@taiga-ui/core';
import { TuiBreadcrumbs } from '@taiga-ui/kit';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpBreadcrumbConfig } from './erp-breadcrumb.types';

@Component({
  selector: 'erp-breadcrumb',
  standalone: true,
  imports: [
    RouterLink,
    TuiBreadcrumbs,
    TuiItem,
    TuiLink,
    TuiIcon,
    ErpTranslatePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let itemsList = _items() ?? [];

    <tui-breadcrumbs class="erp-breadcrumbs-layout">
      @for (item of itemsList; track item.id || item.routerLink || $index) {
        @let labelText = (item.label | erpTranslate) || '';

        @if (item.routerLink && !$last) {
          <a
            *tuiItem
            tuiLink
            [routerLink]="item.routerLink"
            class="erp-breadcrumb-link flex items-center gap-1.5"
          >
            @if (item.iconId) {
              <tui-icon [icon]="item.iconId" class="erp-breadcrumb-icon" />
            }
            <span class="erp-breadcrumb-text">{{ labelText }}</span>
          </a>
        } @else {
          <span
            *tuiItem
            class="erp-breadcrumb-current flex items-center gap-1.5"
          >
            @if (item.iconId) {
              <tui-icon [icon]="item.iconId" class="erp-breadcrumb-icon" />
            }
            <span class="erp-breadcrumb-text">{{ labelText }}</span>
          </span>
        }
      }
    </tui-breadcrumbs>
  `,
  styles: [`
    :host {
      display: block;
    }

    .erp-breadcrumbs-layout {
      align-items: center;
    }

    .erp-breadcrumb-icon {
      width: 1rem;
      height: 1rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .erp-breadcrumb-link {
      color: var(--tui-text-secondary);
      text-decoration: none;
      transition: color 0.2s ease-in-out;
    }

    .erp-breadcrumb-link:hover {
      color: var(--tui-text-primary);
    }

    .erp-breadcrumb-current {
      color: var(--tui-text-primary);
      font-weight: 500;
    }
  `]
})
export class ErpBreadcrumbComponent {
  readonly config = input.required<ErpBreadcrumbConfig>();

  protected readonly internalLoading = signal(false);

  protected readonly _items = computed(() => unwrapSignal(this.config().items));
}
