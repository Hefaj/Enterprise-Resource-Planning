import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DmsContract } from './dms-contract';

describe('DmsContract', () => {
  let component: DmsContract;
  let fixture: ComponentFixture<DmsContract>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DmsContract],
    }).compileComponents();

    fixture = TestBed.createComponent(DmsContract);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
