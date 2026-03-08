import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EBreadcrumbComponent } from './e-breadcrumb.component';

describe('EBreadcrumbComponent', () => {
  let component: EBreadcrumbComponent;
  let fixture: ComponentFixture<EBreadcrumbComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EBreadcrumbComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EBreadcrumbComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
