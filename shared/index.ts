// ── Auth ────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface MeResponse {
  user: User;
}

// ── Vidéos ──────────────────────────────────────────────

export interface Video {
  /** ID YouTube (11 caractères). */
  id: string;
  title: string;
  channel: string;
  views: number;
  description: string;
  thumbnailUrl: string;
}

export interface VideoSearchResponse {
  items: Video[];
  /** Absent sur la dernière page. À renvoyer tel quel en `pageToken`. */
  nextPageToken?: string;
}

// ── Playlists ───────────────────────────────────────────

export interface Playlist {
  id: string;
  name: string;
  /** Date ISO 8601. */
  createdAt: string;
  /** Vidéos de la playlist, la plus récemment ajoutée en premier. */
  videos: Video[];
}

export interface PlaylistListResponse {
  items: Playlist[];
}

export interface CreatePlaylistRequest {
  name: string;
}

export interface RenamePlaylistRequest {
  name: string;
}

export interface AddVideoRequest {
  videoId: string;
}

// ── Erreurs ─────────────────────────────────────────────

export type ErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "WEAK_PASSWORD"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "TOKEN_EXPIRED"
  | "VIDEO_NOT_FOUND"
  | "PLAYLIST_NOT_FOUND"
  | "PLAYLIST_NAME_TAKEN"
  | "VIDEO_ALREADY_IN_PLAYLIST";

/** Format d'erreur unique renvoyé par l'API. */
export interface ApiError {
  code: ErrorCode;
  message: string;
}
