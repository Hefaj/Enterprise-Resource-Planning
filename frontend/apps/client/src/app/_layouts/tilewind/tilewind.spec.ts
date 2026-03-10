import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Tilewind } from './tilewind';

describe('Tilewind', () => {
  let component: Tilewind;
  let fixture: ComponentFixture<Tilewind>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tilewind],
    }).compileComponents();

    fixture = TestBed.createComponent(Tilewind);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
