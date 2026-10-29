import type { Transaction } from '@sequelize/core';
import { Service } from './index.js';
import { Playlist, PlaylistVideo, Video } from '../models/index.js';
import { sequelize } from '../models/db.js';
import type { Video as SharedVideo } from '@enitube/shared';

const withVideos = { include: [{ association: 'entries', include: [{ association: 'video' }] }] };

/**
 * Accès aux playlists. Chaque méthode prend le `userId` du JWT et l'applique dans le WHERE :
 * une playlist d'un autre utilisateur est indiscernable d'une playlist inexistante.
 */
export class PlaylistService extends Service<Playlist> {
  constructor() {
    super(Playlist);
  }

  listByUser(userId: string): Promise<Playlist[]> {
    return this.getAll({ where: { userId }, order: [['name', 'ASC']], ...withVideos });
  }

  /** Playlist du propriétaire avec ses vidéos, ou `null` (id inconnu ou appartenant à un autre). */
  findOwned(id: string, userId: string): Promise<Playlist | null> {
    return this.getOne({ id, userId }, withVideos);
  }

  /** Version légère (sans vidéos) pour les simples contrôles de propriété. */
  async isOwned(id: string, userId: string): Promise<boolean> {
    return (await this.count({ id, userId })) > 0;
  }

  async rename(id: string, userId: string, name: string): Promise<boolean> {
    const [affected] = await this.updateOne({ name }, { id, userId });
    return affected > 0;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    return (await this.deleteOne({ id, userId })) > 0;
  }

  /**
   * Enregistre (ou rafraîchit) le snapshot de la vidéo puis la rattache à la playlist,
   * dans une seule transaction : pas de snapshot orphelin si le rattachement échoue.
   * Lève `UniqueConstraintError` si la vidéo y est déjà, `ForeignKeyConstraintError` si
   * la playlist a été supprimée entre-temps.
   */
  addVideo(playlistId: string, video: SharedVideo): Promise<void> {
    return sequelize.transaction(async (transaction: Transaction) => {
      await Video.upsert(
        {
          id: video.id,
          title: video.title,
          channel: video.channel,
          views: video.views,
          description: video.description,
          thumbnailUrl: video.thumbnailUrl,
        },
        { transaction },
      );
      await PlaylistVideo.create({ playlistId, videoId: video.id }, { transaction });
    });
  }

  async removeVideo(playlistId: string, videoId: string): Promise<boolean> {
    return (await PlaylistVideo.destroy({ where: { playlistId, videoId } })) > 0;
  }
}

export const playlistService = new PlaylistService();
export default playlistService;
