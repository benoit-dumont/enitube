import {
  Model,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from '@sequelize/core';
import {
  Attribute,
  CreatedAt,
  NotNull,
  PrimaryKey,
  Table,
  UpdatedAt,
} from '@sequelize/core/decorators-legacy';

/**
 * Snapshot d'une vidéo, partagé entre tous les utilisateurs : on garde ce qu'il faut pour
 * afficher une playlist sans réinterroger le fournisseur (et sans consommer de quota YouTube).
 */
@Table({ tableName: 'videos', timestamps: true, underscored: true })
export class Video extends Model<InferAttributes<Video>, InferCreationAttributes<Video>> {
  // ID YouTube (11 caractères). BINARY = collation sensible à la casse : « abc » ≠ « ABC ».
  @Attribute(DataTypes.STRING(11).BINARY)
  @PrimaryKey
  declare id: string;

  @Attribute(DataTypes.STRING(255))
  @NotNull
  declare title: string;

  @Attribute(DataTypes.STRING(255))
  @NotNull
  declare channel: string;

  // BIGINT : certaines vidéos dépassent les 4,29 milliards de vues (limite d'un INT non signé).
  // Sequelize renvoie les BIGINT en string, le contrôleur reconvertit en number.
  @Attribute(DataTypes.BIGINT.UNSIGNED)
  @NotNull
  declare views: number | string;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare description: string;

  @Attribute(DataTypes.STRING(512))
  @NotNull
  declare thumbnailUrl: string;

  @CreatedAt
  declare createdAt: CreationOptional<Date>;

  @UpdatedAt
  declare updatedAt: CreationOptional<Date>;
}

export default Video;
