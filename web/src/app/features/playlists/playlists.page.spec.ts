import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { Playlist, Video } from '@enitube/shared';
import { PlaylistService } from '../../services/playlist.service';
import { ToastService } from '../../services/toast.service';
import { PlaylistsPage } from './playlists.page';

const video = (id: string, title: string): Video => ({
  id,
  title,
  channel: 'Chaîne',
  views: 10,
  description: '',
  thumbnailUrl: `http://x/${id}.jpg`,
});

const playlist = (id: string, name: string, videos: Video[] = []): Playlist => ({
  id,
  name,
  createdAt: '2026-01-01T00:00:00.000Z',
  videos,
});

const apiError = (status: number, code?: string) =>
  new HttpErrorResponse({ status, error: code ? { code, message: 'x' } : null });

type Mock = Partial<Record<keyof PlaylistService, ReturnType<typeof vi.fn>>>;

async function setup(mock: Mock) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'playlists', component: PlaylistsPage }]),
      { provide: PlaylistService, useValue: mock },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/playlists', PlaylistsPage);
  const el = harness.routeNativeElement as HTMLElement;
  const click = async (label: RegExp, root: ParentNode = el) => {
    const btn = [...root.querySelectorAll('button')].find((b) => label.test(b.textContent ?? ''));
    if (!btn) throw new Error(`Bouton introuvable : ${label}`);
    btn.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  };
  const submit = async (form: HTMLFormElement) => {
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  };
  return { harness, el, click, submit };
}

describe('PlaylistsPage', () => {
  it('affiche un état de chargement', async () => {
    const { el } = await setup({ list: vi.fn().mockReturnValue(NEVER) });
    expect(el.textContent).toContain('Chargement');
    // Skeleton, pas de texte nu : région annoncée comme occupée.
    expect(el.querySelector('[role=status][aria-busy=true] .skeleton')).not.toBeNull();
  });

  it('affiche un état vide', async () => {
    const { el } = await setup({ list: vi.fn().mockReturnValue(of({ items: [] })) });
    expect(el.textContent).toContain('pas encore de playlist');
  });

  it('affiche une erreur avec « Réessayer » qui recharge', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => apiError(500)))
      .mockReturnValueOnce(of({ items: [playlist('1', 'Musique')] }));
    const { el, click } = await setup({ list });

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Erreur du serveur');
    await click(/Réessayer/);
    expect(list).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Musique');
  });

  it('liste les playlists et leurs vidéos avec un lien « Lancer »', async () => {
    const items = [playlist('1', 'Musique', [video('dQw4w9WgXcQ', 'Titre A')])];
    const { el } = await setup({ list: vi.fn().mockReturnValue(of({ items })) });

    expect(el.textContent).toContain('Musique');
    expect(el.textContent).toContain('1 vidéo');
    expect(el.querySelector('a[href="/video/dQw4w9WgXcQ"]')).not.toBeNull();
  });

  it('crée une playlist et la range par ordre alphabétique', async () => {
    const create = vi.fn().mockReturnValue(of(playlist('2', 'Alpha')));
    const { el, submit } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [playlist('1', 'Zen')] })),
      create,
    });

    const form = el.querySelector('form') as HTMLFormElement;
    (form.querySelector('input') as HTMLInputElement).value = '  Alpha  ';
    await submit(form);

    expect(create).toHaveBeenCalledWith('Alpha');
    const names = [...el.querySelectorAll('h2')].map((h) => h.textContent?.trim());
    expect(names).toEqual(['Alpha', 'Zen']);
  });

  it('refuse un nom vide sans appel réseau', async () => {
    const create = vi.fn();
    const { el, submit } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [] })),
      create,
    });
    await submit(el.querySelector('form') as HTMLFormElement);

    expect(create).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Saisissez un nom');
  });

  it('PLAYLIST_NAME_TAKEN à la création : message sous le champ', async () => {
    const { el, submit } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [] })),
      create: vi.fn().mockReturnValue(throwError(() => apiError(409, 'PLAYLIST_NAME_TAKEN'))),
    });
    const form = el.querySelector('form') as HTMLFormElement;
    (form.querySelector('input') as HTMLInputElement).value = 'Doublon';
    await submit(form);

    expect(el.textContent).toContain('déjà une playlist avec ce nom');
  });

  it('renomme une playlist', async () => {
    const rename = vi.fn().mockReturnValue(of(playlist('1', 'Nouveau')));
    const { el, click, submit } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [playlist('1', 'Ancien')] })),
      rename,
    });

    await click(/Renommer/);
    const form = el.querySelectorAll('form')[1] as HTMLFormElement;
    (form.querySelector('input') as HTMLInputElement).value = 'Nouveau';
    await submit(form);

    expect(rename).toHaveBeenCalledWith('1', 'Nouveau');
    expect(el.querySelector('h2')?.textContent).toContain('Nouveau');
  });

  it('suppression : demande confirmation, rien n’est supprimé avant', async () => {
    const remove = vi.fn().mockReturnValue(of(undefined));
    const { el, click } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [playlist('1', 'Musique')] })),
      remove,
    });

    await click(/^\s*Supprimer/);
    expect(remove).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Supprimer cette playlist ?');

    await click(/Annuler/);
    expect(remove).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Musique');

    await click(/^\s*Supprimer/);
    const group = el.querySelector('[role="group"]') as HTMLElement;
    await click(/^\s*Supprimer\s*$/, group);

    expect(remove).toHaveBeenCalledWith('1');
    expect(el.textContent).not.toContain('Musique');
    expect(el.textContent).toContain('pas encore de playlist');
  });

  it('retire une vidéo sans toucher aux autres playlists', async () => {
    const removeVideo = vi.fn().mockReturnValue(of(undefined));
    const a = video('aaaaaaaaaaa', 'Titre A');
    const b = video('bbbbbbbbbbb', 'Titre B');
    const { el, click } = await setup({
      list: vi
        .fn()
        .mockReturnValue(of({ items: [playlist('1', 'Une', [a, b]), playlist('2', 'Deux', [a])] })),
      removeVideo,
    });

    await click(/Retirer/); // première vidéo de la première playlist

    expect(removeVideo).toHaveBeenCalledWith('1', 'aaaaaaaaaaa');
    const lists = el.querySelectorAll(':scope > div > ul > li');
    expect(lists[0].textContent).not.toContain('Titre A');
    expect(lists[0].textContent).toContain('Titre B');
    expect(lists[1].textContent).toContain('Titre A');
  });

  it('échec du retrait : la vidéo reste et un toast d’erreur reste affiché', async () => {
    const { el, click } = await setup({
      list: vi
        .fn()
        .mockReturnValue(of({ items: [playlist('1', 'Une', [video('aaaaaaaaaaa', 'Titre A')])] })),
      removeVideo: vi.fn().mockReturnValue(throwError(() => apiError(404, 'VIDEO_NOT_FOUND'))),
    });
    await click(/Retirer/);

    expect(el.textContent).toContain('Titre A');
    const toasts = TestBed.inject(ToastService).visible();
    expect(toasts[0]).toMatchObject({ kind: 'error', durationMs: null });
    expect(toasts[0].message).toContain('plus dans la playlist');
  });

  it('retrait réussi : toast avec annulation qui remet la vidéo (vérité serveur)', async () => {
    const a = video('aaaaaaaaaaa', 'Titre A');
    const restored = playlist('1', 'Une', [a]);
    const addVideo = vi.fn().mockReturnValue(of(restored));
    const { el, click } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [playlist('1', 'Une', [a])] })),
      removeVideo: vi.fn().mockReturnValue(of(undefined)),
      addVideo,
    });
    await click(/Retirer/);
    expect(el.textContent).not.toContain('Titre A');

    const toast = TestBed.inject(ToastService).visible()[0];
    expect(toast.durationMs).toBe(5000);
    toast.action?.run();
    expect(addVideo).toHaveBeenCalledWith('1', 'aaaaaaaaaaa');
    expect(TestBed.inject(ToastService).visible().at(-1)?.message).toContain('remise');
  });

  it('crée, renomme, supprime : un toast de succès à chaque fois', async () => {
    const { el, click, submit } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [playlist('1', 'Ancien')] })),
      create: vi.fn().mockReturnValue(of(playlist('2', 'Neuve'))),
      rename: vi.fn().mockReturnValue(of(playlist('1', 'Nouveau'))),
      remove: vi.fn().mockReturnValue(of(undefined)),
    });
    const messages = () =>
      TestBed.inject(ToastService)
        .visible()
        .map((t) => t.message);

    const form = el.querySelector('form') as HTMLFormElement;
    (form.querySelector('input') as HTMLInputElement).value = 'Neuve';
    await submit(form);
    await click(/Renommer Ancien/);
    const edit = el.querySelectorAll('form')[1] as HTMLFormElement;
    (edit.querySelector('input') as HTMLInputElement).value = 'Nouveau';
    await submit(edit);
    await click(/^\s*Supprimer Neuve/);
    await click(/^\s*Supprimer\s*$/, el.querySelector('[role="group"]') as HTMLElement);

    expect(messages()).toEqual([
      expect.stringContaining('« Neuve » créée'),
      expect.stringContaining('renommée en « Nouveau »'),
      expect.stringContaining('« Neuve » supprimée'),
    ]);
  });
});
