import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ForbiddenPage } from './forbidden-page';

describe('ForbiddenPage', () => {
  let component: ForbiddenPage;
  let fixture: ComponentFixture<ForbiddenPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForbiddenPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ForbiddenPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
