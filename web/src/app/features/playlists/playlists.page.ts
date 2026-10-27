import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-playlists-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1 class="text-xl font-semibold">Mes playlists</h1>`,
})
export class PlaylistsPage {}
