import {
  Model,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type NonAttribute,
} from '@sequelize/core';
import {
  Attribute,
  BelongsTo,
  CreatedAt,
  PrimaryKey,
  Table,
} from '@sequelize/core/decorators-legacy';
import { Playlist } from './playlists.js';
import { Video } from './videos.js';

/**
 * Table de jointure playlist ↔ vidéo. La clé primaire composite interdit les doublons
 * (une vidéo ne peut être qu'une fois dans une playlist) ; `createdAt` donne l'ordre d'ajout.
 */
@Table({ tableName: 'playlist_videos', timestamps: true, updatedAt: false, underscored: true })
export class PlaylistVideo extends Model<
  InferAttributes<PlaylistVideo>,
  InferCreationAttributes<PlaylistVideo>
> {
  @Attribute({ type: DataTypes.UUID, onDelete: 'CASCADE' })
  @PrimaryKey
  declare playlistId: string;

  @Attribute({ type: DataTypes.STRING(11).BINARY, onDelete: 'CASCADE' })
  @PrimaryKey
  declare videoId: string;

  @BelongsTo(() => Playlist, {
    foreignKey: 'playlistId',
    inverse: { as: 'entries', type: 'hasMany' },
  })
  declare playlist?: NonAttribute<Playlist>;

  @BelongsTo(() => Video, { foreignKey: 'videoId' })
  declare video?: NonAttribute<Video>;

  @CreatedAt
  declare createdAt: CreationOptional<Date>;
}

export default PlaylistVideo;
