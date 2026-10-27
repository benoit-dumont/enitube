import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1 class="text-xl font-semibold">Rechercher</h1>`,
})
export class SearchPage {}
