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
  NotNull,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from '@sequelize/core/decorators-legacy';
import { User } from './users.js';
import type { PlaylistVideo } from './playlistVideos.js';

@Table({ tableName: 'playlists', timestamps: true, underscored: true })
export class Playlist extends Model<InferAttributes<Playlist>, InferCreationAttributes<Playlist>> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  declare id: string;

  // Propriétaire : toujours issu du JWT, jamais d'un id fourni par le client.
  // Un nom est unique par utilisateur (index composite user_id + name).
  @Attribute({ type: DataTypes.UUID, onDelete: 'CASCADE' })
  @NotNull
  @Unique('playlists_user_id_name')
  declare userId: string;

  @BelongsTo(() => User, { foreignKey: 'userId' })
  declare user?: NonAttribute<User>;

  @Attribute(DataTypes.STRING(100))
  @NotNull
  @Unique('playlists_user_id_name')
  declare name: string;

  @CreatedAt
  declare createdAt: CreationOptional<Date>;

  @UpdatedAt
  declare updatedAt: CreationOptional<Date>;

  /** Présent seulement si la requête a chargé l'association (inverse déclaré dans PlaylistVideo). */
  declare entries?: NonAttribute<PlaylistVideo[]>;
}

export default Playlist;
