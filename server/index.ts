import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { getCorsOptions } from './config/cors.js';
import { securityHeaders, sanitizeInputs, csrfProtection } from './middleware/security.js';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';
import atelieRouter from './routes/atelie.js';
import neonRouter from './routes/neonData.js';
import { logSecurityEvent } from './services/auditLogger.js';

const app = express();

// 1. Helmet Security Suite
app.use(
  helmet({
    contentSecurityPolicy: false, // Managed dynamically for Vite bundling and iframe preview
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: false,
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  })
);

// 2. Custom Security Headers
app.use(securityHeaders);

// 3. Enterprise CORS Configuration with Origin Whitelisting
app.use(cors(getCorsOptions()));

// 4. Cookie Parser for JWT HTTP-only authentication tokens
app.use(cookieParser());

// 5. Payload Size Limitation (Prevent Denial of Service / Memory Exhaustion attacks)
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// 6. Automated Input Sanitization (Strips XSS, HTML tags, script injection, control characters)
app.use(sanitizeInputs);

// 6.1 State-Changing Origin / CSRF Verification
app.use(csrfProtection);

// 7. Mount Modular Secure API, Auth & Ateliê Routers with '/api' prefix
app.use('/api/auth', authRouter);
app.use('/api/atelie', atelieRouter);
app.use('/api/neon', neonRouter);
app.use('/api', authRouter);
app.use('/api', neonRouter);
app.use('/api', apiRouter);

// 7.1 Fallback direct mounting if Vercel serverless environment strips the '/api' prefix
app.use('/auth', authRouter);
app.use('/atelie', atelieRouter);
app.use('/neon', neonRouter);
app.use('/', authRouter);
app.use('/', neonRouter);
app.use('/', apiRouter);

// 8. 404 Handler for undefined API routes (prevent route probing)
app.all(['/api/*', '/api'], (req: Request, res: Response) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

  logSecurityEvent({
    type: 'SUSPICIOUS_PAYLOAD',
    severity: 'INFO',
    ip,
    path: req.originalUrl || req.url,
    method: req.method,
    details: 'Attempted to access non-existent API endpoint',
  });

  res.status(404).json({ error: 'Endpoint da API não encontrado.' });
});

// 9. Global Secure Error Handler (prevents sensitive internal stack traces from leaking)
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

  logSecurityEvent({
    type: 'SUSPICIOUS_PAYLOAD',
    severity: 'CRITICAL',
    ip,
    path: req.originalUrl || req.url,
    method: req.method,
    details: `Unhandled server exception: ${err?.message || 'Unknown error'}`,
  });

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Tamanho da requisição excede o limite de segurança permitido (64kb).' });
  }

  res.status(err.status || 500).json({
    error: 'Ocorreu um erro interno no servidor. Por favor, tente novamente.',
  });
});

export default app;
export { app };
