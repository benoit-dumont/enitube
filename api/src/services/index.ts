import type {
  Model,
  ModelStatic,
  WhereOptions,
  FindOptions,
  FindAttributeOptions,
  Attributes,
  CreationAttributes,
} from '@sequelize/core';

/**
 * Service générique implémentant les opérations CRUD de base pour un modèle Sequelize.
 * Remplace l'ancienne classe statique `Service` (héritée par sous-classe) par une
 * classe générique instanciée une fois par modèle : plus sûr côté typage, et
 * évite le couplage par héritage pour un simple accès aux données.
 */
export class Service<M extends Model> {
  constructor(protected readonly model: ModelStatic<M>) {}

  async getAll(options?: FindOptions<Attributes<M>>): Promise<M[]> {
    return this.model.findAll(options);
  }

  async createOne(params: CreationAttributes<M>): Promise<M> {
    return this.model.create(params);
  }

  async count(where?: WhereOptions<Attributes<M>>): Promise<number> {
    return this.model.count({ where });
  }

  /** Insertion groupée (un seul INSERT) : à préférer à une boucle de `createOne`. */
  async createMany(params: CreationAttributes<M>[]): Promise<M[]> {
    return this.model.bulkCreate(params);
  }

  async findOrCreate(
    where: WhereOptions<Attributes<M>>,
    defaults?: CreationAttributes<M>,
  ): Promise<[M, boolean]> {
    return this.model.findOrCreate({ where, defaults });
  }

  async getOne(
    where: WhereOptions<Attributes<M>>,
    options?: Omit<FindOptions<Attributes<M>>, 'where'>,
  ): Promise<M | null> {
    return this.model.findOne({ where, ...options });
  }

  async updateOne(
    data: Partial<Attributes<M>>,
    where: WhereOptions<Attributes<M>>,
  ): Promise<[affectedCount: number]> {
    return this.model.update(data, { where });
  }

  async deleteOne(where: WhereOptions<Attributes<M>>): Promise<number> {
    return this.model.destroy({ where });
  }
}

export type { FindAttributeOptions };
export default Service;
