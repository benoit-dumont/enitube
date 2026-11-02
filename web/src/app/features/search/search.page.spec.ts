import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Video, VideoSearchResponse } from '@enitube/shared';
import { PlaylistService } from '../../services/playlist.service';
import { VideoService } from '../../services/video.service';
import { SEARCH_DEBOUNCE_MS, SearchPage } from './search.page';

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

describe('SearchPage : recherche à la frappe', () => {
  afterEach(() => vi.useRealTimers());

  const settle = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const input = (el: HTMLElement) => el.querySelector('input') as HTMLInputElement;
  const type = (el: HTMLElement, value: string) => {
    input(el).value = value;
    input(el).dispatchEvent(new Event('input'));
  };
  /** Écoule le temps simulé puis laisse le routeur et le rendu se terminer. */
  const wait = async (fixture: Parameters<typeof settle>[0], ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    await settle(fixture);
  };

  it('attend la fin de la frappe : une seule requête, sur le dernier terme', async () => {
    const search = vi.fn().mockReturnValue(of({ items: [v('aaaaaaaaaaa')] }));
    const { fixture, router, el } = await setup(search);
    vi.useFakeTimers();

    type(el, 'py');
    await wait(fixture, 200);
    type(el, 'pyt');
    await wait(fixture, SEARCH_DEBOUNCE_MS - 1);
    expect(search).not.toHaveBeenCalled();

    await wait(fixture, 1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('pyt', undefined);
    expect(router.url).toBe('/search?q=pyt');
  });

  it('n’interroge pas sous 2 caractères', async () => {
    const search = vi.fn().mockReturnValue(of({ items: [] }));
    const { fixture, el } = await setup(search);
    vi.useFakeTimers();

    type(el, 'p');
    await wait(fixture, SEARCH_DEBOUNCE_MS * 3);
    expect(search).not.toHaveBeenCalled();
  });

  it('Entrée lance tout de suite et le debounce ne relance pas la même recherche', async () => {
    const search = vi.fn().mockReturnValue(of({ items: [v('aaaaaaaaaaa')] }));
    const { fixture, el } = await setup(search);
    vi.useFakeTimers();

    type(el, 'py');
    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await wait(fixture, 0);
    expect(search).toHaveBeenCalledTimes(1);

    await wait(fixture, SEARCH_DEBOUNCE_MS * 2);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('une nouvelle frappe annule la requête en cours : la réponse périmée est ignorée', async () => {
    const stale = new Subject<VideoSearchResponse>();
    const search = vi
      .fn()
      .mockReturnValueOnce(stale)
      .mockReturnValueOnce(of({ items: [v('ccccccccccc')] }));
    const { fixture, el } = await setup(search);
    vi.useFakeTimers();

    type(el, 'ab');
    await wait(fixture, SEARCH_DEBOUNCE_MS);
    type(el, 'abc');
    await wait(fixture, SEARCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledTimes(2);
    expect(stale.observed).toBe(false); // désabonné : la requête HTTP est annulée

    stale.next({ items: [v('ddddddddddd')] });
    await settle(fixture);
    expect(el.textContent).toContain('tccccccccccc');
    expect(el.textContent).not.toContain('tddddddddddd');
  });

  it('garde les résultats précédents (atténués) pendant la nouvelle recherche', async () => {
    const next = new Subject<VideoSearchResponse>();
    const search = vi
      .fn()
      .mockReturnValueOnce(of({ items: [v('aaaaaaaaaaa')] }))
      .mockReturnValueOnce(next);
    const { fixture, router, el } = await setup(search);
    await router.navigate([], { queryParams: { q: 'py' } });
    await settle(fixture);
    vi.useFakeTimers();

    type(el, 'pyt');
    await wait(fixture, SEARCH_DEBOUNCE_MS);
    expect(el.querySelector('[aria-busy=true].opacity-60')).not.toBeNull();
    expect(el.querySelectorAll('app-video-card').length).toBe(1); // pas de flash de skeleton
    expect(el.querySelector('.skeleton')).toBeNull();
    expect(el.textContent).toContain('pour « py »'); // le libellé suit les résultats affichés

    next.next({ items: [v('bbbbbbbbbbb'), v('ccccccccccc')] });
    next.complete();
    await settle(fixture);
    expect(el.querySelector('[aria-busy=true]')).toBeNull();
    expect(el.textContent).toContain('pour « pyt »');
    expect(el.querySelectorAll('app-video-card').length).toBe(2);
  });

  it('deux recherches qui se remplacent : l’indicateur de chargement reste allumé', async () => {
    const search = vi
      .fn()
      .mockReturnValueOnce(of({ items: [v('aaaaaaaaaaa')] }))
      .mockReturnValueOnce(new Subject<VideoSearchResponse>())
      .mockReturnValueOnce(new Subject<VideoSearchResponse>());
    const { fixture, router, el } = await setup(search);
    await router.navigate([], { queryParams: { q: 'py' } });
    await settle(fixture);
    vi.useFakeTimers();

    type(el, 'pyt');
    await wait(fixture, SEARCH_DEBOUNCE_MS);
    type(el, 'pyth');
    await wait(fixture, SEARCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledTimes(3);
    // La 2e requête a désabonné la 1re : sa fin ne doit pas éteindre l'indicateur de la 2e.
    expect(el.querySelector('[aria-busy=true]')).not.toBeNull();
  });

  it('champ vidé : retour à l’état initial, sans q dans l’URL', async () => {
    const search = vi.fn().mockReturnValue(of({ items: [v('aaaaaaaaaaa')] }));
    const { fixture, router, el } = await setup(search);
    await router.navigate([], { queryParams: { q: 'py' } });
    await settle(fixture);
    vi.useFakeTimers();

    type(el, '');
    await wait(fixture, SEARCH_DEBOUNCE_MS);
    expect(el.textContent).toContain('Saisissez un mot-clé');
    expect(router.url).toBe('/search');
  });

  it('le champ suit l’URL (retour arrière) mais n’écrase pas la frappe en cours', async () => {
    const search = vi.fn().mockReturnValue(of({ items: [v('aaaaaaaaaaa')] }));
    const { fixture, router, el } = await setup(search);
    await router.navigate([], { queryParams: { q: 'foo' } });
    await settle(fixture);
    expect(input(el).value).toBe('foo');

    vi.useFakeTimers();
    type(el, 'foob');
    await wait(fixture, SEARCH_DEBOUNCE_MS);
    await router.navigate([], { queryParams: { q: 'foobar' } }); // navigation extérieure
    type(el, 'foobar!'); // l'utilisateur a déjà continué de taper
    await settle(fixture);
    expect(input(el).value).toBe('foobar!');
  });
});
