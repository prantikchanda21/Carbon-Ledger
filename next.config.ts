import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['onnxruntime-node', 'glpk.js'],
  transpilePackages: ['three'],
  outputFileTracingIncludes: {
    '/api/onnx-controller': ['./public/models/**/*'],
    '/api/sweep': ['./public/models/**/*'],
    '/api/benchmark': ['./public/models/**/*'],
  },
  outputFileTracingExcludes: {
    '/api/onnx-controller': [
      '**/onnxruntime-node/bin/napi-v*/win32/**',
      '**/onnxruntime-node/bin/napi-v*/darwin/**',
      '**/onnxruntime-node/bin/napi-v*/linux/arm64/**',
    ],
    '/api/sweep': [
      '**/onnxruntime-node/bin/napi-v*/win32/**',
      '**/onnxruntime-node/bin/napi-v*/darwin/**',
      '**/onnxruntime-node/bin/napi-v*/linux/arm64/**',
    ],
  },
};

export default nextConfig;
