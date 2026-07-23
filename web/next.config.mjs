import pkg from './package.json' with { type: 'json' };

/** @type {import('next').NextConfig} */
export default {
  // self-contained server bundle for the Docker image
  output: 'standalone',
  // the parser workspace package ships raw TypeScript sources
  transpilePackages: ['bellwright-parse'],
  // native module — must not be bundled by Turbopack
  serverExternalPackages: ['better-sqlite3'],
  // surface the app version to the client (shown in the UI settings menu)
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
};
