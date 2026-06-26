import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'convex/**/*.test.ts', 'hooks/**/*.test.mjs'],
    // Do NOT inherit a real Clerk key from .env.local into the test runtime.
    // When the key is set, Clerk-gated code paths (e.g. ForgePage's ClerkAuthProbe)
    // mount and call useUser()/useAuth(), which throw outside a <ClerkProvider/>.
    // Tests are written for the unconfigured "dev mode" path; force it here.
    //
    // VITE_ASTRIDR_API_KEY: set a sentinel value so authHeaders() includes the
    // Authorization: Bearer header in tests (required by T-90-AUTH assertions in
    // useWarRoomVoice.test.ts). The value is not a real credential.
    env: {
      VITE_CLERK_PUBLISHABLE_KEY: '',
      VITE_ASTRIDR_API_KEY: 'test-api-key',
    },
  },
});
