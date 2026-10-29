import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';
import type { Video, VideoSearchResponse } from '@enitube/shared';
import { PlaylistService } from '../../services/playlist.service';
import { VideoService } from '../../services/video.service';
import { SearchPage } from './search.page';

const v = (id: string): Video => ({
  id,
  title: `t${id}`,
  channel: 'c',
  views: 1500,
  description: 'd',
  thumbnailUrl: `http://x/${id}.jpg`,
});

async function setup(search: ReturnType<typeof vi.fn>, playlists: object = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'search', component: SearchPage }]),
      { provide: VideoService, useValue: { search } },
      { provide: PlaylistService, useValue: playlists },
    ],
  });
  const router = TestBed.inject(Router);
  await router.navigateByUrl('/search');
  const fixture = TestBed.createComponent(SearchPage);
  fixture.detectChanges();
  return { fixture, router, el: fixture.nativeElement as HTMLElement };
}

describe('SearchPage', () => {
  it('idle sans q, puis résultats après navigation ?q=', async () => {
    const search = vi
      .fn()
      .mockReturnValue(of({ items: [v('aaaaaaaaaaa')] } satisfies VideoSearchResponse));
    const { fixture, router, el } = await setup(search);
    expect(el.textContent).toContain('Saisissez un mot-clé');
    await router.navigate([], { queryParams: { q: 'py' } });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(search).toHaveBeenCalledWith('py', undefined);
    expect(el.querySelectorAll('app-video-card').length).toBe(1);
    expect(el.textContent).toMatch(/1,5\s*k vues/); // Intl met un espace insécable fin
    expect(el.textContent).not.toContain('Charger plus');
  });

  it('empty, error + retry', async () => {
    const search = vi
      .fn()
      .mockReturnValueOnce(of({ items: [] }))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(of({ items: [v('bbbbbbbbbbb')] }));
    const { fixture, router, el } = await setup(search);
    await router.navigate([], { queryParams: { q: 'zz' } });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Aucune vidéo trouvée');
    await router.navigate([], { queryParams: { q: 'yy' } });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Erreur du serveur');
    (el.querySelector('[role=alert] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelectorAll('app-video-card').length).toBe(1);
  });

  it('charger plus ajoute sans muter, et une nouvelle recherche annule la réponse périmée', async () => {
    const page1: VideoSearchResponse = { items: [v('aaaaaaaaaaa')], nextPageToken: '12' };
    const late = new Subject<VideoSearchResponse>();
    const search = vi
      .fn()
      .mockReturnValueOnce(of(page1))
      .mockReturnValueOnce(late)
      .mockReturnValueOnce(of({ items: [v('ccccccccccc')] }));
    const { fixture, router, el } = await setup(search);
    await router.navigate([], { queryParams: { q: 'a' } });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const more = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Charger plus'),
    ) as HTMLButtonElement;
    more.click();
    fixture.detectChanges();
    expect(search).toHaveBeenLastCalledWith('a', '12');
    expect(page1.items.length).toBe(1);
    await router.navigate([], { queryParams: { q: 'b' } });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    late.next({ items: [v('ddddddddddd')] }); // réponse périmée : doit être ignorée
    fixture.detectChanges();
    expect(el.querySelectorAll('app-video-card').length).toBe(1);
    expect(el.textContent).toContain('tccccccccccc');
  });

  it('ouvre la modal d’ajout depuis une carte, puis la ferme', async () => {
    const search = vi.fn().mockReturnValue(of({ items: [v('aaaaaaaaaaa')] }));
    const list = vi.fn().mockReturnValue(of({ items: [] }));
    const { fixture, router, el } = await setup(search, { list });
    await router.navigate([], { queryParams: { q: 'py' } });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('app-playlist-modal')).toBeNull();

    const add = [...el.querySelectorAll('app-video-card button')].find((b) =>
      b.textContent?.includes('Ajouter à une playlist'),
    ) as HTMLButtonElement;
    add.click();
    fixture.detectChanges();
    expect(el.querySelector('app-playlist-modal [role=dialog]')).not.toBeNull();
    expect(list).toHaveBeenCalled();

    (
      el.querySelector(
        'app-playlist-modal button[aria-label="Fermer la fenêtre"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(el.querySelector('app-playlist-modal')).toBeNull();
  });
});
