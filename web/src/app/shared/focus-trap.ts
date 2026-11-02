import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, inject } from '@angular/core';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Piège le focus clavier dans l'élément (modal) : Tab et Maj+Tab bouclent, et un focus qui
 * s'échappe (clic hors modal, bouton devenu inactif) est ramené à l'intérieur.
 * L'écoute est au niveau du document : si le focus est déjà sorti, un Tab doit y revenir.
 */
@Directive({
  selector: '[appFocusTrap]',
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(document:focusin)': 'onFocusin($event)',
  },
})
export class FocusTrap {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly doc = inject(DOCUMENT);

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const items = this.focusables();
    if (items.length === 0) {
      event.preventDefault();
      this.host.focus();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = this.doc.activeElement;
    const inside = active !== null && this.host.contains(active);

    if (event.shiftKey && (!inside || active === first || active === this.host)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  protected onFocusin(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof Node) || this.host.contains(target)) return;
    // Les toasts vivent hors de la modal mais doivent rester atteignables au clavier.
    if (target instanceof Element && target.closest('[aria-label="Notifications"]')) return;
    (this.focusables()[0] ?? this.host).focus();
  }

  private focusables(): HTMLElement[] {
    return Array.from(this.host.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hidden && el.getAttribute('aria-hidden') !== 'true',
    );
  }
}
