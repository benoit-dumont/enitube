import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { Video } from '@enitube/shared';
import { VideoService } from '../../services/video.service';
import { VideoPage } from './video.page';

const VALID_ID = 'dQw4w9WgXcQ';

const video: Video = {
  id: VALID_ID,
  title: 'Titre de test',
  channel: 'Chaîne de test',
  views: 1500000,
  description: 'Description de test',
  thumbnailUrl: `http://x/${VALID_ID}.jpg`,
};

const notFound = () =>
  new HttpErrorResponse({ status: 404, error: { code: 'VIDEO_NOT_FOUND', message: 'nope' } });

async function setup(getById: ReturnType<typeof vi.fn>, id: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'video/:id', component: VideoPage }]),
      { provide: VideoService, useValue: { getById } },
    ],
  });
  // Le harness rend le composant dans sa vraie route, donc avec le paramètre `:id`.
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(`/video/${id}`, VideoPage);
  const el = harness.routeNativeElement as HTMLElement;
  return { harness, el };
}

describe('VideoPage', () => {
  it('affiche les métadonnées et un iframe youtube-nocookie', async () => {
    const getById = vi.fn().mockReturnValue(of(video));
    const { el } = await setup(getById, VALID_ID);

    expect(getById).toHaveBeenCalledWith(VALID_ID);
    expect(el.querySelector('h1')?.textContent).toContain('Titre de test');
    expect(el.textContent).toContain('Chaîne de test');
    expect(el.textContent).toMatch(/1\s*500\s*000\s*vues/); // Intl met des espaces insécables
    expect(el.textContent).toContain('Description de test');

    const iframe = el.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toBe(`https://www.youtube-nocookie.com/embed/${VALID_ID}`);
    expect(iframe?.getAttribute('title')).toBe('Titre de test');
  });

  it('ID mal formé : « introuvable » sans aucun appel réseau', async () => {
    const getById = vi.fn();
    const { el } = await setup(getById, 'pas-un-id');

    expect(getById).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Vidéo introuvable');
    expect(el.querySelector('iframe')).toBeNull();
  });

  it('VIDEO_NOT_FOUND renvoyé par l’API : « introuvable »', async () => {
    const getById = vi.fn().mockReturnValue(throwError(notFound));
    const { el } = await setup(getById, VALID_ID);

    expect(el.textContent).toContain('Vidéo introuvable');
    expect(el.querySelector('iframe')).toBeNull();
  });

  it('erreur serveur : message d’erreur puis réessayer', async () => {
    const getById = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(of(video));
    const { harness, el } = await setup(getById, VALID_ID);

    expect(el.querySelector('[role=alert]')?.textContent).toContain('Erreur du serveur');
    (el.querySelector('[role=alert] button') as HTMLButtonElement).click();
    harness.detectChanges();

    expect(getById).toHaveBeenCalledTimes(2);
    expect(el.querySelector('h1')?.textContent).toContain('Titre de test');
  });
});
