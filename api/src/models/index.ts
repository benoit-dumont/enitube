import { Sequelize } from '@sequelize/core';
import { MySqlDialect } from '@sequelize/mysql';
import Logger from '../lib/Logger/index.js';

export const sequelize = new Sequelize({
  dialect: MySqlDialect,
  database: process.env.DB_BDD,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST || 'localhost',
  // @sequelize/mysql (alpha) n'applique pas de port par défaut : sans lui, la connexion
  // échoue avec une AssertionError interne ("port has not been normalized").
  port: Number(process.env.DB_PORT) || 3306,
  timezone: '+02:00',
  models: [],
  logging: (sql: string) => process.env.APP_DEBUG === 'true' && Logger.debug(sql),
});

/**
 * Vérifie la connexion à la base et synchronise les modèles.
 * Doit être appelée une fois au démarrage de l'application (voir `server.ts` / `bin/process`).
 */
export async function initDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    Logger.success('Connexion à MySQL valide');
  } catch (error) {
    Logger.error(`❌ Connexion à MySQL invalide: ${String(error)}`);
    throw error;
  }

  try {
    Logger.success('Les models ont été synchronisés avec succès.');
  } catch (error) {
    Logger.error(`❌ Impossible de synchroniser les models: ${String(error)}`);
    throw error;
  }
}

export default { sequelize, initDatabase };
