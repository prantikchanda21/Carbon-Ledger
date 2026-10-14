import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['onnxruntime-node', 'glpk.js'],
  transpilePackages: ['three'],
  outputFileTracingIncludes: {
    '/api/onnx-controller': ['./public/models/**/*'],
    '/api/sweep': ['./public/models/**/*'],
    '/api/benchmark': ['./public/models/**/*'],
    '/api/schedule': ['./public/models/**/*'],
    '/api/command': ['./public/models/**/*'],
  },
  outputFileTracingExcludes: {
    '/api/*': [
      '**/onnxruntime-node/bin/napi-v*/win32/**',
      '**/onnxruntime-node/bin/napi-v*/darwin/**',
      '**/onnxruntime-node/bin/napi-v*/linux/arm64/**',
      '**/onnxruntime-node/bin/napi-v*/linux/x64/libonnxruntime_providers_cuda*',
      './quantum_lab/**', './artifacts/**', './qiskit_train/**', './offline_handlers/**',
    ],
  },
};

export default nextConfig;
