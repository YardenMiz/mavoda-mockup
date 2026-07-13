// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://yardenmiz.github.io',
  base: '/mavoda-mockup',
  build: {
    // Keep the existing filenames (about.html, chess.html, ...) instead of
    // Astro's default about/index.html, so every relative link and script
    // path already in the markup keeps working unchanged.
    format: 'file',
  },
});
