import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_DEBUG: z.enum(['true', 'false']).default('false'),
  ALLOWED_ORIGIN: z.string().default('*'),

  MYSQL_ROOT_PASSWORD: z.string().min(1),

  MYSQL_BDD: z.string().min(1),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASS: z.string().min(1),
  MYSQL_HOST: z.string().default('localhost'),
  MYSQL_PORT: z.coerce.number().default(3307),

  MAILPIT_SMTP_PORT: z.coerce.number().default(1025),
  MAILPIT_UI_PORT: z.coerce.number().default(8025),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit faire au moins 32 caractères'),
  JWT_ACCESS_TTL: z.string().default('15m'),

  // Source des vidéos : catalogue local (défaut, aucun quota) ou YouTube Data API v3.
  VIDEO_PROVIDER: z.enum(['catalog', 'youtube']).default('catalog'),
  YOUTUBE_API_KEY: z.string().trim().optional(),
});

const refined = schema.refine((e) => e.VIDEO_PROVIDER !== 'youtube' || !!e.YOUTUBE_API_KEY, {
  path: ['YOUTUBE_API_KEY'],
  message: 'YOUTUBE_API_KEY est requise quand VIDEO_PROVIDER=youtube',
});

export const env = refined.parse(process.env);
