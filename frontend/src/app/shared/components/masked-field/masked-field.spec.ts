import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MaskedField } from './masked-field';

describe('MaskedField', () => {
  let component: MaskedField;
  let fixture: ComponentFixture<MaskedField>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaskedField],
    }).compileComponents();

    fixture = TestBed.createComponent(MaskedField);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'EIN');
    fixture.componentRef.setInput('maskedValue', '••••6789');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the masked value by default', () => {
    expect((component as any).displayValue()).toBe('••••6789');
  });

  it('emits revealRequested on first toggle, but not again once a value is cached', () => {
    const revealSpy = vi.fn();
    component.revealRequested.subscribe(revealSpy);

    (component as any).toggle();
    expect(revealSpy).toHaveBeenCalledTimes(1);
    expect((component as any).displayValue()).toBe('••••6789');

    fixture.componentRef.setInput('revealedValue', '12-3456789');
    expect((component as any).displayValue()).toBe('12-3456789');

    (component as any).toggle();
    expect((component as any).displayValue()).toBe('••••6789');

    (component as any).toggle();
    expect((component as any).displayValue()).toBe('12-3456789');
    expect(revealSpy).toHaveBeenCalledTimes(1);
  });
});
