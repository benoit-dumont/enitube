import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  const make = () => TestBed.inject(ToastService);

  it('durées par gravité : 4 s, 4 s, 7 s, erreur jusqu’à validation', () => {
    const s = make();
    s.success('a');
    s.info('b');
    s.warning('c');
    expect(s.visible().map((t) => t.durationMs)).toEqual([4000, 4000, 7000]);
    TestBed.resetTestingModule();
    const e = make();
    e.error('d');
    expect(e.visible()[0].durationMs).toBeNull();
  });

  it('3 toasts visibles au plus, les autres attendent leur tour', () => {
    const s = make();
    ['1', '2', '3', '4'].forEach((m) => s.success(m));
    expect(s.visible().map((t) => t.message)).toEqual(['1', '2', '3']);
    s.dismiss(s.visible()[0].id);
    expect(s.visible().map((t) => t.message)).toEqual(['2', '3', '4']);
  });

  it('l’erreur n’expire pas, et la durée peut être imposée', () => {
    const s = make();
    s.error('e');
    s.info('i', { durationMs: 5000 });
    expect(s.visible().map((t) => t.durationMs)).toEqual([null, 5000]);
  });
});
