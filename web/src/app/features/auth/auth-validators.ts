import { AbstractControl, ValidationErrors } from '@angular/forms';

/** bcrypt ignore tout au-delà de 72 octets : même limite que l'API (en octets, pas en caractères). */
export function maxBytes(max: number) {
  const encoder = new TextEncoder();
  return (control: AbstractControl<string>): ValidationErrors | null =>
    encoder.encode(control.value ?? '').length > max ? { maxbytes: { max } } : null;
}

/** Évite un nom ou un email composé uniquement d'espaces (l'API fait un trim). */
export function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return (control.value ?? '').trim().length === 0 ? { required: true } : null;
}
