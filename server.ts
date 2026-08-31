import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { env } from './server/config/env.js';
import app from './server/index.js';
import { ensureTablesExist, getDatabaseUrl } from './server/db/index.js';

const PORT = env.PORT || 3000;

// Configure Vite development middleware or Static asset hosting for production
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

export default app;
export { app };
