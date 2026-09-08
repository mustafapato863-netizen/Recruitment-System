import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as cookieParser from 'cookie-parser';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const runtimeNodeEnv = process.env.NODE_ENV ?? config.get<string>('NODE_ENV', 'development');
  const isProduction = runtimeNodeEnv === 'production';

  // Validate critical environment variables at startup (fail-fast in production)
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'EMAIL_OUTBOX_ENCRYPTION_KEY',
    'SELF_SCHEDULE_SECRET',
  ];
  for (const envVar of requiredEnvVars) {
    if (!(process.env[envVar] ?? config.get<string>(envVar))) {
      if (isProduction) {
        logger.error(`FATAL: Environment variable ${envVar} must be configured in production.`);
        process.exit(1);
      } else {
        logger.warn(`Startup warning: Environment variable ${envVar} is not explicitly configured.`);
      }
    }
  }

  // Configure trust proxy from explicit environment configuration or dev default
  const trustProxyConfig = config.get<string>('TRUST_PROXY') ?? process.env.TRUST_PROXY ?? (!isProduction ? 'true' : undefined);
  if (trustProxyConfig) {
    const expressApp = app.getHttpAdapter().getInstance() as { set: (key: string, val: unknown) => void };
    if (typeof expressApp.set === 'function') {
      const parsedTrust = isNaN(Number(trustProxyConfig)) ? (trustProxyConfig === 'true') : Number(trustProxyConfig);
      expressApp.set('trust proxy', parsedTrust);
    }
  }

  // Global security headers middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http: https:;");
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    if (req.path.startsWith('/api/v1/auth/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());

  const configuredOrigins = new Set(
    config
      .get<string>('WEB_ORIGIN', 'http://localhost:5173')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const isDevelopment = runtimeNodeEnv !== 'production';

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const isLocalDevelopmentOrigin =
        isDevelopment &&
        (/^http:\/\/localhost:\d+$/.test(origin ?? '') ||
          /^http:\/\/127\.0\.0\.1:\d+$/.test(origin ?? ''));

      if (!origin || configuredOrigins.has(origin) || isLocalDevelopmentOrigin) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (validationErrors) => {
        const fields: Record<string, string[]> = {};
        for (const error of validationErrors) {
          const constraints = Object.values(error.constraints ?? {});
          if (constraints.length > 0) {
            fields[error.property] = constraints;
          }
        }
        return new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Please correct the highlighted fields.',
          fields,
        });
      },
    }),
  );

  const port = Number(process.env.RECRUITFLOW_API_PORT || process.env.PORT || config.get<number>('API_PORT', 3000));
  await app.listen(port);
  logger.log(`RecruitFlow API running on port ${port}`);
}

void bootstrap();
