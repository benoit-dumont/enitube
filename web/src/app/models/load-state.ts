/** État d'un chargement asynchrone côté UI : idle → loading → success | error. */
export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };
