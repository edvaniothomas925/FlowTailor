import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import fs from 'fs';

// Automatically set up PWA assets from our generated high-fidelity logo
try {
  if (!fs.existsSync('./public')) {
    fs.mkdirSync('./public', { recursive: true });
  }
  const logoPath = './src/assets/images/flowtailor_icon_1780250676445.png';
  if (fs.existsSync(logoPath)) {
    fs.copyFileSync(logoPath, './public/icon.png');
    fs.copyFileSync(logoPath, './public/icon-192.png');
    fs.copyFileSync(logoPath, './public/icon-512.png');
    console.log('PWA logo assets successfully synchronized.');
  }
} catch (err) {
  console.warn('Could not copy PWA assets automatically:', err);
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
