import { Sequelize } from '@sequelize/core';
import { MySqlDialect } from '@sequelize/mysql';
import Logger from '../lib/Logger/index.js';
import { User } from './index.js';

export const sequelize = new Sequelize({
  dialect: MySqlDialect,
  database: process.env.MYSQL_BDD,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  host: process.env.MYSQL_HOST || 'localhost',
  // @sequelize/mysql (alpha) n'applique pas de port par défaut : sans lui, la connexion
  // échoue avec une AssertionError interne ("port has not been normalized").
  port: Number(process.env.MYSQL_PORT) || 3306,
  timezone: '+02:00',
  models: [User],
  logging: (sql: string) => process.env.APP_DEBUG === 'true' && Logger.debug(sql),
});

/**
 * Vérifie la connexion à la base puis crée les tables manquantes.
 * Doit être appelée une fois au démarrage de l'application (voir `server.ts`).
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
    // Sans option : CREATE TABLE IF NOT EXISTS. Les tables existantes ne sont jamais modifiées.
    await sequelize.sync();
    Logger.success('Les tables ont été créées si nécessaire.');
  } catch (error) {
    Logger.error(`❌ Impossible de créer les tables: ${String(error)}`);
    throw error;
  }
}

export default { sequelize, initDatabase };
