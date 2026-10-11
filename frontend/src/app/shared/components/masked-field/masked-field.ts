import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-masked-field',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './masked-field.html',
  styleUrl: './masked-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaskedField {
  readonly label = input.required<string>();
  readonly maskedValue = input<string | null | undefined>(null);
  readonly revealedValue = input<string | null>(null);
  readonly canReveal = input(false);
  readonly isRevealing = input(false);

  readonly revealRequested = output<void>();

  protected readonly isShowingReal = signal(false);

  protected readonly displayValue = computed(() =>
    this.isShowingReal() && this.revealedValue() !== null ? this.revealedValue() : this.maskedValue(),
  );

  protected toggle(): void {
    if (this.isShowingReal()) {
      this.isShowingReal.set(false);
      return;
    }
    if (this.revealedValue() === null) {
      this.revealRequested.emit();
    }
    this.isShowingReal.set(true);
  }
}
