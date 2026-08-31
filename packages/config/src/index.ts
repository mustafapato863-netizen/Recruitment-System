import { z } from 'zod';

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  VACANCY_CORE_ADAPTER: z.enum(['in-memory', 'prisma']).default('in-memory'),
  REDIS_URL: z.url().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  AUTH_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_IP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(25),
  AUTH_LOCKOUT_DURATION: z.coerce.number().int().positive().default(900),
  AUTH_WINDOW_DURATION: z.coerce.number().int().positive().default(300),
});

export type Environment = z.infer<typeof environmentSchema>;
