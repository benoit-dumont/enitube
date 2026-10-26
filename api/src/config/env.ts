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
});
export const env = schema.parse(process.env);
