import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErpMenu } from './erp-menu';

describe('ErpMenu', () => {
  let component: ErpMenu;
  let fixture: ComponentFixture<ErpMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErpMenu],
    }).compileComponents();

    fixture = TestBed.createComponent(ErpMenu);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
