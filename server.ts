import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { env } from './server/config/env.js';
import { getCorsOptions } from './server/config/cors.js';
import { securityHeaders, sanitizeInputs, csrfProtection } from './server/middleware/security.js';
import apiRouter from './server/routes/api.js';
import authRouter from './server/routes/auth.js';
import atelieRouter from './server/routes/atelie.js';
import neonRouter from './server/routes/neonData.js';
import { ensureTablesExist, getDatabaseUrl } from './server/db/index.js';
import { logSecurityEvent } from './server/services/auditLogger.js';

const app = express();
const PORT = env.PORT || 3000;

// 1. Helmet Security Suite (Content-Security-Policy, HSTS, noSniff, xssFilter, DNS prefetch, Origin-Agent-Cluster)
app.use(
  helmet({
    contentSecurityPolicy: false, // Managed for Vite live bundling and cross-origin iframe preview
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: false, // Frame access managed cleanly via preview headers
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

// 7. Mount Modular Secure API, Auth & Ateliê Routers
app.use('/api/auth', authRouter);
app.use('/api/atelie', atelieRouter);
app.use('/api', neonRouter);
app.use('/api', apiRouter);

// 8. 404 Handler for undefined API routes (prevent route probing)
app.all('/api/*', (req: Request, res: Response) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

  logSecurityEvent({
    type: 'SUSPICIOUS_PAYLOAD',
    severity: 'INFO',
    ip,
    path: req.originalUrl,
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
    path: req.originalUrl,
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

// 10. Configure Vite development middleware or Static asset hosting for production
async function configureApp() {
  // Executar auto-provisionamento DDL de todas as tabelas no Neon antes do arranque dos pedidos
  if (getDatabaseUrl()) {
    console.log('[NEON] Conexão detectada. A auto-provisionar/verificar tabelas relacionais (atelies, clientes, encomendas, medidas, solicitacoes_pagamento, configuracoes, admins)...');
    try {
      const initResult = await ensureTablesExist();
      if (initResult.success) {
        console.log('[NEON] Tabelas relacionais prontas no Neon PostgreSQL com admin inicial edvaniothomas925@gmail.com.');
      } else {
        console.warn('[NEON] Aviso na inicialização DDL:', initResult.error);
      }
    } catch (dbErr) {
      console.warn('[NEON] Falha ao auto-provisionar tabelas no arranque:', dbErr);
    }
  }

  if (env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[SECURITY] FlowTailor Dev Server initialized with Vite middleware & CyberDefense stack.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[SECURITY] FlowTailor Production Server initialized with static protection.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SECURITY] FlowTailor Cyber-Protected Server active on port ${PORT}`);
  });
}

configureApp();


