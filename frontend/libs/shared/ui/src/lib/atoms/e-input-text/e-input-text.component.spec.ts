import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EInputTextComponent } from './e-input-text.component';

describe('EInputTextComponent', () => {
  let component: EInputTextComponent;
  let fixture: ComponentFixture<EInputTextComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EInputTextComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EInputTextComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
