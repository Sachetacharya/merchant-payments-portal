import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-forbidden-page',
  styleUrl: './forbidden-page.scss',
  templateUrl: './forbidden-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenPage {}
