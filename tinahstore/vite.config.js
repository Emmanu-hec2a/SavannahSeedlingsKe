import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { siteBrandingPlugin } from './scripts/lib/site-branding-plugin.mjs';

export default defineConfig({
  plugins: [react(), siteBrandingPlugin()],
});
