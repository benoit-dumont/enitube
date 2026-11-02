import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from '../../services/toast.service';
import { ToastContainer } from './toast-container';

async function setup() {
  const fixture = TestBed.createComponent(ToastContainer);
  const toasts = TestBed.inject(ToastService);
  const el = fixture.nativeElement as HTMLElement;
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await flush();
  return { toasts, el, flush };
}

describe('ToastContainer', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  it('affiche icône + message, status pour une info et alert pour une erreur', async () => {
    const { toasts, el, flush } = await setup();
    toasts.success('Enregistré');
    toasts.error('Échec');
    await flush();
    const items = el.querySelectorAll('li > app-toast-item > div');
    expect(items[0].getAttribute('role')).toBe('status');
    expect(items[1].getAttribute('role')).toBe('alert');
    expect(items[0].querySelector('svg')).not.toBeNull();
    expect(el.textContent).toContain('Enregistré');
  });

  it('se ferme seul après la durée ; l’erreur reste', async () => {
    const { toasts, el, flush } = await setup();
    toasts.success('ok');
    toasts.error('ko');
    await flush();
    vi.advanceTimersByTime(4000);
    await flush();
    expect(el.textContent).not.toContain('ok');
    expect(el.textContent).toContain('ko');
  });

  it('le survol met le timer en pause et il reprend avec le temps restant', async () => {
    const { toasts, el, flush } = await setup();
    toasts.success('pause');
    await flush();
    const item = el.querySelector('app-toast-item') as HTMLElement;

    vi.advanceTimersByTime(3000);
    item.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(60_000);
    await flush();
    expect(el.textContent).toContain('pause');

    item.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(999);
    await flush();
    expect(el.textContent).toContain('pause');
    vi.advanceTimersByTime(1);
    await flush();
    expect(el.textContent).not.toContain('pause');
  });

  it('bouton Fermer et action : l’action s’exécute puis referme', async () => {
    const { toasts, el, flush } = await setup();
    const run = vi.fn();
    toasts.info('Retirée', { durationMs: 5000, action: { label: 'Annuler', run } });
    await flush();
    expect(el.querySelector('.toast-countdown')).not.toBeNull();

    (el.querySelector('button:not([aria-label])') as HTMLButtonElement).click();
    await flush();
    expect(run).toHaveBeenCalledOnce();
    expect(el.textContent).not.toContain('Retirée');

    toasts.warning('x');
    await flush();
    (el.querySelector('button[aria-label="Fermer la notification"]') as HTMLButtonElement).click();
    await flush();
    expect(el.querySelector('app-toast-item')).toBeNull();
  });
});
