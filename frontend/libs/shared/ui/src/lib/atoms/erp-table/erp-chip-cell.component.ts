import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiChip } from '@taiga-ui/kit';
import { TuiAppearance } from '@taiga-ui/core';
import { ErpCellRichContent } from './erp-table.types';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';

@Component({
  selector: 'erp-chip-cell',
  standalone: true,
  imports: [CommonModule, TuiChip, TuiAppearance, ErpTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="erp-chip-cell">
      @if (content().cellChips?.length) {
        <div class="erp-chip-cell__cell-chips">
          @for (chip of content().cellChips; track $index) {
            <span 
              tuiChip 
              [size]="chip.size === 's' ? 'xs' : (chip.size || 'xs')" 
              [tuiAppearance]="chip.appearance || 'info'"
              class="erp-chip-cell__chip transform scale-[0.85] origin-left"
            >
              {{ (chip.shortText || chip.text) | erpTranslate }}
            </span>
          }
        </div>
      }
      
      @for (line of content().lines; track $index) {
        <div class="erp-chip-cell__line">
          <span class="erp-chip-cell__text">{{ line.text }}</span>
          @if (line.chips?.length) {
            <div class="erp-chip-cell__line-chips">
              @for (chip of line.chips; track $index) {
                <span 
                  tuiChip 
                  [size]="chip.size === 's' ? 'xs' : (chip.size || 'xs')" 
                  [tuiAppearance]="chip.appearance || 'info'"
                  class="erp-chip-cell__chip transform scale-[0.85] origin-left"
                >
                  {{ (chip.shortText || chip.text) | erpTranslate }}
                </span>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .erp-chip-cell {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.125rem 0;
    }
    
    .erp-chip-cell__line {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      min-height: 1.25rem;
      line-height: 1.4;
    }
    
    .erp-chip-cell__text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .erp-chip-cell__line-chips,
    .erp-chip-cell__cell-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    
    .erp-chip-cell__line-chips {
      flex-shrink: 0;
    }
    
    .erp-chip-cell__cell-chips {
      align-self: flex-end;
      margin-bottom: 0.125rem;
    }
  `]
})
export class ErpChipCellComponent {
  content = input.required<ErpCellRichContent>();
}
