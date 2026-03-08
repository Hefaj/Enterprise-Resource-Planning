import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EButtonComponent } from './e-button.component';

describe('EButtonComponent', () => {
  let component: EButtonComponent;
  let fixture: ComponentFixture<EButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EButtonComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
