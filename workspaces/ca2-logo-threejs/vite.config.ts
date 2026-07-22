import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5178,
    strictPort: true,
    open: false,
    // Cloudflare quick tunnels / VS Code port forwards send a public Host header
    allowedHosts: true,
  },
});
