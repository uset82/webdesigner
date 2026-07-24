import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5179,
    // If 5179 is busy, try 5180+ instead of crashing (check terminal for actual URL).
    strictPort: false,
    open: true,
    allowedHosts: true,
  },
  publicDir: 'public',
});
