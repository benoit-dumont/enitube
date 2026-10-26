import { z } from 'zod';
import HttpError from '../class/HttpError.js';

// Politique : 10 caractères minimum, 72 octets maximum (limite de bcrypt), aucune règle de composition
const password = z
  .string()
  .min(10, 'Mot de passe trop court (10 caractères minimum)')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Mot de passe trop long (72 octets maximum)');

const email = z.string().trim().toLowerCase().email('Email invalide').max(255);

export const registerSchema = z.object({
  username: z.string().trim().min(3, 'Nom trop court').max(30, 'Nom trop long'),
  email,
  password,
});

export const loginSchema = z.object({
  email,
  // Pas de politique au login : on ne révèle rien, on compare simplement
  password: z.string().min(1).max(1024),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Valide un corps de requête ; WEAK_PASSWORD si le mot de passe est en cause, sinon VALIDATION_ERROR. */
export function parseBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issues = result.error.issues;
  const message = issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' | ');
  const errorCode = issues.some((i) => i.path[0] === 'password')
    ? 'WEAK_PASSWORD'
    : 'VALIDATION_ERROR';
  throw new HttpError({ code: 400, errorCode, message });
}
