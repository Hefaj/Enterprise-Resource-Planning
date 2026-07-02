import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiBreadcrumbs } from '@taiga-ui/kit';
import { TuiItem } from '@taiga-ui/cdk';
import { TuiLink, TuiIcon } from '@taiga-ui/core';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpBreadcrumbConfig, ErpBreadcrumbItem } from './erp-breadcrumb.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterLink, TuiBreadcrumbs, TuiItem, TuiLink, TuiIcon, ErpTranslatePipe],
  template: `
    <tui-breadcrumbs>
      @for (item of breadcrumbList(); track $index) {
        @if (item.routerLink) {
          <a *tuiItem tuiLink [routerLink]="item.routerLink">
            @if (item.iconId === 'home') {
              <tui-icon icon="@tui.home"></tui-icon>
            } @else {
              {{ (item.label | erpTranslate) || '' }}
            }
          </a>
        } @else {
          <span *tuiItem>
            {{ (item.label | erpTranslate) || '' }}
          </span>
        }
      }
    </tui-breadcrumbs>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpBreadcrumbComponent {
  public config = input.required<ErpBreadcrumbConfig>();

  protected home = computed(() => unwrapSignal(this.config().home));
  protected items = computed(() => unwrapSignal(this.config().items));

  protected breadcrumbList = computed(() => {
    const list: ErpBreadcrumbItem[] = [];
    const homeVal = this.home();
    if (homeVal) {
      list.push(homeVal);
    }
    const itemsVal = this.items();
    if (itemsVal) {
      list.push(...itemsVal);
    }
    return list;
  });
}
