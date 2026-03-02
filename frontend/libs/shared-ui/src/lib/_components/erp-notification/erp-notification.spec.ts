import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErpNotification } from './erp-notification';

describe('ErpNotification', () => {
  let component: ErpNotification;
  let fixture: ComponentFixture<ErpNotification>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErpNotification],
    }).compileComponents();

    fixture = TestBed.createComponent(ErpNotification);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
