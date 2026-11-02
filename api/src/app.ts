/**
 * @file Configuration file for app.
 * @author DUMONT Benoit <benoit.dum74@gmail.com>
 *
 * @module App
 */

import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { apiReference } from '@scalar/express-api-reference';

import authRouter from './routes/auth.js';
import videosRouter from './routes/videos.js';
import playlistsRouter from './routes/playlists.js';

import HttpError from './class/HttpError.js';
import Logger from './lib/Logger/index.js';

const app = express();

app.use(express.json({ limit: '1mb' }));

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content, Accept, Content-Type, Authorization, X-Admin-Token',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  next();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Documentation OpenAPI : le YAML est la source de vérité (voir openapi.yaml à la racine),
// exposé en JSON pour les outils (Insomnia, etc.) et rendu lisible sur /reference.
const openApiSpec = parseYaml(readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf-8'));
app.get('/openapi.json', (_req, res) => res.json(openApiSpec));
app.use('/reference', apiReference({ url: '/openapi.json' }));

app.use('/auth', authRouter);
app.use('/videos', videosRouter);
app.use('/playlists', playlistsRouter);

interface BodyParserError extends Error {
  status: number;
  type: string;
}

const isBodyParserError = (error: unknown): error is BodyParserError =>
  error instanceof Error &&
  typeof (error as Partial<BodyParserError>).status === 'number' &&
  (error as BodyParserError).status >= 400 &&
  (error as BodyParserError).status < 500 &&
  typeof (error as Partial<BodyParserError>).type === 'string';

// Error handling centralisé (Express 5 forward automatiquement les rejets de Promise ici)
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.code).json(error.toBody());
    return;
  }
  // JSON malformé, corps trop gros, charset non supporté… : les erreurs de body-parser portent un
  // statut 4xx, c'est la faute du client et non une panne serveur.
  if (isBodyParserError(error)) {
    const isMalformed = error.type === 'entity.parse.failed';
    res.status(error.status).json({
      code: 'VALIDATION_ERROR',
      message: isMalformed ? 'JSON malformé' : error.message,
    });
    return;
  }
  Logger.error(error);
  res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);

export default app;
