import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideTransloco, TranslocoTestingModule } from '@jsverse/transloco';

import { ErpSelectComponent } from './erp-select.component';
import { ErpSelectBuilder } from './erp-select.builder';
import { ErpSelectItemComponent } from './erp-select.types';

@Component({
  selector: 'erp-test-custom-option',
  standalone: true,
  template: `<span class="custom-item">Custom: {{ item().name }}</span>`,
})
class TestCustomOptionComponent {
  readonly item = input.required<{ id: number; name: string }>();
}

// Verification that compiler type safety works for item component
const _compCheck: ErpSelectItemComponent<{ id: number; name: string }> = TestCustomOptionComponent;
console.log(_compCheck);

describe('ErpSelectComponent', () => {
  let component: ErpSelectComponent<{ id: number; name: string }>;
  let fixture: ComponentFixture<ErpSelectComponent<{ id: number; name: string }>>;

  const mockItems = [
    { id: 1, name: 'Opcja 1' },
    { id: 2, name: 'Opcja 2' },
    { id: 3, name: 'Opcja 3' },
    { id: 4, name: 'Opcja 4' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ErpSelectComponent,
        ReactiveFormsModule,
        TranslocoTestingModule.forRoot({
          langs: { pl: {} },
          translocoConfig: { availableLangs: ['pl'], defaultLang: 'pl' },
        }),
      ],
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['pl'],
            defaultLang: 'pl',
          },
        }),
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ErpSelectComponent<{ id: number; name: string }>);
    component = fixture.componentInstance;
  });

  it('powinien utworzyć komponent z konfiguracji Single Builder', () => {
    const config = new ErpSelectBuilder<{ id: number; name: string }>()
      .setItems(mockItems)
      .setStringify((item) => item.name)
      .setStrategy('single')
      .build();

    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('powinien poprawnie obsługiwać wybór wielokrotny (multi) oraz tekst podsumowania gdy przekroczono maxChipsCount', () => {
    const config = new ErpSelectBuilder<{ id: number; name: string }>()
      .setItems(mockItems)
      .setStringify((item) => item.name)
      .setStrategy('multi')
      .setMaxChipsCount(2)
      .build();

    const control = new FormControl([mockItems[0], mockItems[1], mockItems[2]]);
    fixture.componentRef.setInput('config', config);
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comp = component as any;
    expect(comp.showSummaryText()).toBe(true);
    expect(comp.summaryText()).toBe('Wybranych elementów (3)');
  });

  it('powinien akceptować customowy komponent dla opcji ze wskazanym inputem item', () => {
    const config = new ErpSelectBuilder<{ id: number; name: string }>()
      .setItems(mockItems)
      .setItemComponent(TestCustomOptionComponent)
      .build();

    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comp = component as any;
    expect(comp._itemComponent()).toBe(TestCustomOptionComponent);
  });
});
