import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { TranslocoInlineLoader } from '@erp/shared/ui';

import { ErpReportPivotLabelCellComponent } from './erp-report-pivot-label-cell.component';
import { ErpReportPivotRow } from './erp-report-pivot-label-cell.types';

describe('ErpReportPivotLabelCellComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ErpReportPivotLabelCellComponent],
      providers: [
        provideTransloco({
          config: { availableLangs: ['pl-PL'], defaultLang: 'pl-PL', reRenderOnLangChange: true },
          loader: TranslocoInlineLoader,
        }),
      ],
    });
  });

  const groupRow: ErpReportPivotRow = {
    kind: 'group',
    code: 'DEV',
    name: 'Development',
    hoursByPeriod: new Map(),
    total: 40,
  };

  const leafRow: ErpReportPivotRow = {
    kind: 'leaf',
    groupCode: 'DEV',
    key: 'DEV-142',
    hoursByPeriod: new Map(),
    total: 8,
  };

  it('renders a real, keyboard-operable <button> with aria-expanded for a group row', () => {
    const fixture = TestBed.createComponent(ErpReportPivotLabelCellComponent);
    fixture.componentRef.setInput('row', groupRow);
    fixture.componentRef.setInput('isExpanded', () => false);
    fixture.componentRef.setInput('onToggle', () => undefined);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent).toContain('DEV');
    expect(button.textContent).toContain('Development');
  });

  it('reflects isExpanded(row) in aria-expanded', () => {
    const fixture = TestBed.createComponent(ErpReportPivotLabelCellComponent);
    fixture.componentRef.setInput('row', groupRow);
    fixture.componentRef.setInput('isExpanded', (row: ErpReportPivotRow) => row.kind === 'group' && row.code === 'DEV');
    fixture.componentRef.setInput('onToggle', () => undefined);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('calls onToggle with the row when the button is activated', () => {
    const onToggle = vi.fn();
    const fixture = TestBed.createComponent(ErpReportPivotLabelCellComponent);
    fixture.componentRef.setInput('row', groupRow);
    fixture.componentRef.setInput('isExpanded', () => false);
    fixture.componentRef.setInput('onToggle', onToggle);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();

    expect(onToggle).toHaveBeenCalledWith(groupRow);
  });

  it('renders a leaf row as plain indented text, with no button at all', () => {
    const fixture = TestBed.createComponent(ErpReportPivotLabelCellComponent);
    fixture.componentRef.setInput('row', leafRow);
    fixture.componentRef.setInput('isExpanded', () => false);
    fixture.componentRef.setInput('onToggle', () => undefined);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('DEV-142');
  });
});
