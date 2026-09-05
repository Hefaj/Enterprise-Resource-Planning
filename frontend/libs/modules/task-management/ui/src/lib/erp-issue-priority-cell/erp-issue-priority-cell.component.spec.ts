import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { TranslocoInlineLoader } from '@erp/shared/ui';
import { ISSUE_PRIORITY } from '@erp/task-management/util';

import { ErpIssuePriorityCellComponent } from './erp-issue-priority-cell.component';

describe('ErpIssuePriorityCellComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ErpIssuePriorityCellComponent],
      providers: [
        provideTransloco({
          config: { availableLangs: ['pl-PL'], defaultLang: 'pl-PL', reRenderOnLangChange: true },
          loader: TranslocoInlineLoader,
        }),
      ],
    });
  });

  it('marks critical and high priority with the negative-status dot', () => {
    for (const priority of [ISSUE_PRIORITY.Critical, ISSUE_PRIORITY.High]) {
      const fixture = TestBed.createComponent(ErpIssuePriorityCellComponent);
      fixture.componentRef.setInput('row', { priority });
      fixture.detectChanges();

      const dot = fixture.nativeElement.querySelector('span[aria-hidden="true"]') as HTMLElement;
      expect(dot.className).toContain('bg-[var(--tui-status-negative)]');
    }
  });

  it('marks low and lowest priority with the tertiary-text dot', () => {
    for (const priority of [ISSUE_PRIORITY.Low, ISSUE_PRIORITY.Lowest]) {
      const fixture = TestBed.createComponent(ErpIssuePriorityCellComponent);
      fixture.componentRef.setInput('row', { priority });
      fixture.detectChanges();

      const dot = fixture.nativeElement.querySelector('span[aria-hidden="true"]') as HTMLElement;
      expect(dot.className).toContain('bg-[var(--tui-text-tertiary)]');
    }
  });

  it('falls back to the warning dot for normal priority and missing priority alike', () => {
    for (const priority of [ISSUE_PRIORITY.Normal, undefined]) {
      const fixture = TestBed.createComponent(ErpIssuePriorityCellComponent);
      fixture.componentRef.setInput('row', { priority });
      fixture.detectChanges();

      const dot = fixture.nativeElement.querySelector('span[aria-hidden="true"]') as HTMLElement;
      expect(dot.className).toContain('bg-[var(--tui-status-warning)]');
    }
  });
});
