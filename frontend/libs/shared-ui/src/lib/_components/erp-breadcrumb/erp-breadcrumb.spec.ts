import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErpBreadcrumb } from './erp-breadcrumb';

describe('ErpBreadcrumb', () => {
  let component: ErpBreadcrumb;
  let fixture: ComponentFixture<ErpBreadcrumb>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErpBreadcrumb],
    }).compileComponents();

    fixture = TestBed.createComponent(ErpBreadcrumb);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
