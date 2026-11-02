import http from 'node:http';
import './config.js';
import app from './app.js';
import { initDatabase } from './models/db.js';
import Logger from './lib/Logger/index.js';

interface SyscallError extends Error {
  syscall?: string;
  code?: string;
}

const normalizePort = (val: string): number | string => {
  const port = parseInt(val, 10);
  return !Number.isNaN(port) && port >= 0 ? port : val;
};

const port = normalizePort(process.env.PORT ?? '3000');
app.set('port', port);

const server = http.createServer(app);

const errorHandler = (error: SyscallError): void => {
  if (error.syscall !== 'listen') {
    throw error;
  }
  const address = server.address();
  const bind = typeof address === 'string' ? `pipe ${address}` : `port ${port}`;
  switch (error.code) {
    case 'EACCES':
      throw new Error(`${bind} Pas de permissions.`);
    case 'EADDRINUSE':
      throw new Error(`Port ${bind} déjà utilisé.`);
    default:
      throw error;
  }
};

const start = async (): Promise<void> => {
  await initDatabase();

  server.on('error', errorHandler);
  server.on('listening', () => {
    const address = server.address();
    const bind = typeof address === 'string' ? `pipe ${address}` : port;
    Logger.info(`🔍 Port en cours d'utilisation: ${bind}`);
  });

  server.listen(port);
};

start().catch((error) => {
  Logger.error(`Impossible de démarrer le serveur: ${String(error)}`);
});
