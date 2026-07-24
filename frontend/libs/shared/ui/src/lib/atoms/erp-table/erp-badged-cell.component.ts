import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiBadge } from '@taiga-ui/kit';
import { TuiAppearance } from '@taiga-ui/core';
import { ErpCellRichContent } from './erp-table.types';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';

@Component({
  selector: 'erp-badged-cell',
  standalone: true,
  imports: [CommonModule, TuiBadge, TuiAppearance, ErpTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="erp-badged-cell">
      @if (content().cellBadges?.length) {
        <div class="erp-badged-cell__cell-badges">
          @for (badge of content().cellBadges; track $index) {
            <span 
              tuiBadge 
              [size]="badge.size || 's'" 
              [tuiAppearance]="badge.appearance || 'info'"
              class="erp-badged-cell__badge"
            >
              {{ badge.text | erpTranslate }}
            </span>
          }
        </div>
      }
      
      @for (line of content().lines; track $index) {
        <div class="erp-badged-cell__line">
          <span class="erp-badged-cell__text">{{ line.text }}</span>
          @if (line.badges?.length) {
            <div class="erp-badged-cell__line-badges">
              @for (badge of line.badges; track $index) {
                <span 
                  tuiBadge 
                  [size]="badge.size || 's'" 
                  [tuiAppearance]="badge.appearance || 'info'"
                  class="erp-badged-cell__badge"
                >
                  {{ badge.text | erpTranslate }}
                </span>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .erp-badged-cell {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.125rem 0;
    }
    
    .erp-badged-cell__line {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      min-height: 1.25rem;
      line-height: 1.4;
    }
    
    .erp-badged-cell__text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .erp-badged-cell__line-badges,
    .erp-badged-cell__cell-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    
    .erp-badged-cell__line-badges {
      flex-shrink: 0;
    }
    
    .erp-badged-cell__cell-badges {
      align-self: flex-end;
      margin-bottom: 0.125rem;
    }
  `]
})
export class ErpBadgedCellComponent {
  content = input.required<ErpCellRichContent>();
}
