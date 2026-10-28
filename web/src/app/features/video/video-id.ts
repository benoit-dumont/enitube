/** ID YouTube : 11 caractères parmi lettres, chiffres, `_` et `-` (même règle que l'API). */
export const VIDEO_ID_REGEX = /^[\w-]{11}$/;

/** Base de l'embed sans cookies de suivi : seul hôte autorisé pour l'iframe. */
export const EMBED_BASE_URL = 'https://www.youtube-nocookie.com/embed/';

export function isValidVideoId(id: string | null): id is string {
  return id !== null && VIDEO_ID_REGEX.test(id);
}
