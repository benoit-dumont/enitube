import { z } from 'zod';

/** ID YouTube : 11 caractères parmi lettres, chiffres, `_` et `-`. */
export const VIDEO_ID_REGEX = /^[\w-]{11}$/;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Recherche vide').max(100, 'Recherche trop longue'),
  // Opaque pour le client ; pour le catalogue c'est un offset, on borne donc la forme.
  pageToken: z
    .string()
    .regex(/^\d{1,6}$/, 'pageToken invalide')
    .optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
