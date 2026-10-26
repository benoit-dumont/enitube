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
  Unique,
  UpdatedAt,
} from '@sequelize/core/decorators-legacy';

@Table({ tableName: 'users', timestamps: true, underscored: true })
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  declare id: string;

  @Attribute(DataTypes.STRING(30))
  @NotNull
  declare username: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  @Unique
  declare email: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare passwordHash: string;

  @CreatedAt
  declare createdAt: CreationOptional<Date>;

  @UpdatedAt
  declare updatedAt: CreationOptional<Date>;
}

export default User;
