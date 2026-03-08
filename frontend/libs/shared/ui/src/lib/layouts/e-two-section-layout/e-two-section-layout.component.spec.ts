import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ETwoSectionLayoutComponent } from './e-two-section-layout.component';

describe('ETwoSectionLayoutComponent', () => {
  let component: ETwoSectionLayoutComponent;
  let fixture: ComponentFixture<ETwoSectionLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ETwoSectionLayoutComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ETwoSectionLayoutComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
