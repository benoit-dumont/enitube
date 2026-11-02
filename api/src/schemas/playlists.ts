import { z } from 'zod';

const name = z.string().trim().min(1, 'Nom vide').max(100, 'Nom trop long');

export const createPlaylistSchema = z.object({ name });
export const renamePlaylistSchema = z.object({ name });

// Le format de l'ID vidéo est vérifié dans le contrôleur (VIDEO_NOT_FOUND, pas VALIDATION_ERROR),
// comme pour GET /videos/:id : un ID mal formé ne peut simplement pas exister.
export const addVideoSchema = z.object({ videoId: z.string().min(1).max(64) });

export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>;
export type RenamePlaylistInput = z.infer<typeof renamePlaylistSchema>;
export type AddVideoInput = z.infer<typeof addVideoSchema>;
