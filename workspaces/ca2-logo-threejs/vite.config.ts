import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5180,
    strictPort: false,
    open: true,
    allowedHosts: true,
  },
  publicDir: 'public',
});
