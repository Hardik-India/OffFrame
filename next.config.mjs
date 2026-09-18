const config = {
  turbopack: { root: process.cwd() },
  distDir: process.env.OFFFRAME_TEST_BUILD === '1' ? '.next-test' : '.next',
  output: 'standalone',
  serverExternalPackages: ['sharp', 'mongodb'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
    ] }];
  }
};
export default config;
