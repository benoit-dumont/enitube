import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { Playlist, Video } from '@enitube/shared';
import { PlaylistService } from '../../../services/playlist.service';
import { PlaylistModal } from './playlist-modal';

const video = (id: string): Video => ({
  id,
  title: `titre ${id}`,
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

const V = video('aaaaaaaaaaa');

type Mock = Partial<Record<keyof PlaylistService, ReturnType<typeof vi.fn>>>;

@Component({
  imports: [PlaylistModal],
  template: `<app-playlist-modal [video]="video()" (closed)="closes.set(closes() + 1)" />`,
})
class Host {
  readonly video = signal(V);
  readonly closes = signal(0);
}

async function setup(mock: Mock) {
  TestBed.configureTestingModule({
    providers: [{ provide: PlaylistService, useValue: mock }],
  });
  const fixture = TestBed.createComponent(Host);
  const el = fixture.nativeElement as HTMLElement;
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await flush();
  const click = async (label: RegExp) => {
    const btn = [...el.querySelectorAll('button')].find((b) => label.test(b.textContent ?? ''));
    if (!btn) throw new Error(`Bouton introuvable : ${label}`);
    btn.click();
    await flush();
  };
  const submitNew = async (name: string) => {
    const input = el.querySelector('#modal-new-playlist') as HTMLInputElement;
    input.value = name;
    (input.form as HTMLFormElement).dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
  };
  return { fixture, el, click, submitNew, host: fixture.componentInstance };
}

describe('PlaylistModal', () => {
  it('affiche le chargement, puis les playlists triées par nom', async () => {
    const list = vi.fn().mockReturnValue(NEVER);
    const first = await setup({ list });
    expect(first.el.querySelector('[role=status]')?.textContent).toContain('Chargement');
    TestBed.resetTestingModule();

    const second = await setup({
      list: vi
        .fn()
        .mockReturnValue(of({ items: [playlist('2', 'Zèbre'), playlist('1', 'Alpha')] })),
    });
    const names = [...second.el.querySelectorAll('li p.font-semibold')].map((p) => p.textContent);
    expect(names).toEqual(['Alpha', 'Zèbre']);
    expect(second.el.querySelector('[role=dialog]')).not.toBeNull();
  });

  it('état vide et erreur avec réessai', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => apiError(500)))
      .mockReturnValueOnce(of({ items: [] }));
    const { el, click } = await setup({ list });
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Erreur du serveur');
    await click(/Réessayer/);
    expect(el.textContent).toContain('pas encore de playlist');
  });

  it('ajoute la vidéo et remplace la playlist par la version renvoyée par l’API', async () => {
    const addVideo = vi.fn().mockReturnValue(of(playlist('1', 'Alpha', [V])));
    const { el, click } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [playlist('1', 'Alpha')] })),
      addVideo,
    });
    await click(/^\s*Ajouter/);
    expect(addVideo).toHaveBeenCalledWith('1', 'aaaaaaaaaaa');
    expect(el.textContent).toContain('Ajoutée à « Alpha »');
    expect(el.textContent).toContain('Déjà ajoutée');
    expect(el.textContent).toContain('1 vidéo');
  });

  it('désactive l’ajout quand la vidéo est déjà dans la playlist', async () => {
    const { el } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [playlist('1', 'Alpha', [V])] })),
    });
    expect(el.textContent).toContain('Déjà ajoutée');
    const addButtons = [...el.querySelectorAll('button')].filter((b) =>
      /^\s*Ajouter/.test(b.textContent ?? ''),
    );
    expect(addButtons.length).toBe(0);
  });

  it('409 : message dédié et affichage corrigé', async () => {
    const addVideo = vi
      .fn()
      .mockReturnValue(throwError(() => apiError(409, 'VIDEO_ALREADY_IN_PLAYLIST')));
    const { el, click } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [playlist('1', 'Alpha')] })),
      addVideo,
    });
    await click(/^\s*Ajouter/);
    expect(el.querySelector('[role=alert]')?.textContent).toContain('déjà dans cette playlist');
    expect(el.textContent).toContain('Déjà ajoutée');
  });

  it('autres erreurs d’ajout : message, bouton toujours disponible', async () => {
    const addVideo = vi.fn().mockReturnValue(throwError(() => apiError(404, 'VIDEO_NOT_FOUND')));
    const { el, click } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [playlist('1', 'Alpha')] })),
      addVideo,
    });
    await click(/^\s*Ajouter/);
    expect(el.querySelector('[role=alert]')?.textContent).toContain('introuvable');
    expect(
      [...el.querySelectorAll('button')].some((b) => /^\s*Ajouter/.test(b.textContent ?? '')),
    ).toBe(true);
  });

  it('crée une playlist à la volée puis y ajoute la vidéo', async () => {
    const created = playlist('9', 'Neuve');
    const create = vi.fn().mockReturnValue(of(created));
    const addVideo = vi.fn().mockReturnValue(of(playlist('9', 'Neuve', [V])));
    const { el, submitNew } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [playlist('1', 'Alpha')] })),
      create,
      addVideo,
    });
    await submitNew('  Neuve ');
    expect(create).toHaveBeenCalledWith('Neuve');
    expect(addVideo).toHaveBeenCalledWith('9', 'aaaaaaaaaaa');
    expect(el.textContent).toContain('Ajoutée à « Neuve »');
    expect((el.querySelector('#modal-new-playlist') as HTMLInputElement).value).toBe('');
  });

  it('création : nom vide refusé, nom pris signalé, pas d’ajout si la création échoue', async () => {
    const create = vi.fn().mockReturnValue(throwError(() => apiError(409, 'PLAYLIST_NAME_TAKEN')));
    const addVideo = vi.fn();
    const { el, submitNew } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [] })),
      create,
      addVideo,
    });
    await submitNew('   ');
    expect(create).not.toHaveBeenCalled();
    expect(el.querySelector('#modal-new-playlist-error')?.textContent).toContain(
      'Saisissez un nom',
    );
    await submitNew('Doublon');
    expect(el.querySelector('#modal-new-playlist-error')?.textContent).toContain(
      'déjà une playlist',
    );
    expect(addVideo).not.toHaveBeenCalled();
  });

  it('création réussie mais ajout en échec : la playlist reste listée', async () => {
    const create = vi.fn().mockReturnValue(of(playlist('9', 'Neuve')));
    const addVideo = vi.fn().mockReturnValue(throwError(() => apiError(500)));
    const { el, submitNew } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [] })),
      create,
      addVideo,
    });
    await submitNew('Neuve');
    expect(el.textContent).toContain('Neuve');
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Erreur du serveur');
  });

  it('un seul appel d’écriture à la fois', async () => {
    const addVideo = vi.fn().mockReturnValue(NEVER);
    const { el, click } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [playlist('1', 'A'), playlist('2', 'B')] })),
      addVideo,
    });
    await click(/^\s*Ajouter/);
    const others = [...el.querySelectorAll('button')].filter((b) =>
      /^\s*Ajouter/.test(b.textContent ?? ''),
    );
    expect(others.every((b) => b.disabled)).toBe(true);
    others[0].click();
    expect(addVideo).toHaveBeenCalledTimes(1);
  });

  it('se ferme via Fermer, le fond ou Échap', async () => {
    const { el, click, host, fixture } = await setup({
      list: vi.fn().mockReturnValue(of({ items: [] })),
    });
    await click(/^\s*Fermer\s*$/);
    expect(host.closes()).toBe(1);
    (el.querySelector('button[aria-label="Fermer la fenêtre"]') as HTMLButtonElement).click();
    expect(host.closes()).toBe(2);
    el.querySelector('[role=dialog]')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    expect(host.closes()).toBe(3);
  });
});
