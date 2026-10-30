import type { NextConfig } from 'next';

// Routes that call GLPK (glpk.js WebAssembly) and/or the bundled ONNX controller.
// Vercel traces files per route, and the '/*' glob does not match nested '/api/...' routes,
// so each route is listed explicitly to guarantee the wasm + model ship with the function.
const GLPK_ROUTES = [
  '/api/onnx-controller',
  '/api/cooperative-allocation',
  '/api/sweep',
  '/api/benchmark',
  '/api/health',
  '/api/schedule',
  '/api/command',
];
const ONNX_ROUTES = ['/api/onnx-controller', '/api/sweep', '/api/benchmark', '/api/health', '/api/schedule', '/api/command'];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Vercel builds should not be blocked by presentational ESLint findings.
  // TypeScript validation remains enabled; run npm run lint separately.
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  serverExternalPackages: ['onnxruntime-node', 'glpk.js'],
  transpilePackages: ['three'],
  outputFileTracingIncludes: {
    '/*': ['./node_modules/glpk.js/dist/**/*'],
    ...Object.fromEntries(GLPK_ROUTES.map((route) => [route, ['./node_modules/glpk.js/dist/**/*']])),
    ...Object.fromEntries(ONNX_ROUTES.map((route) => [route, [
      './node_modules/glpk.js/dist/**/*',
      './public/models/**/*',
      './node_modules/onnxruntime-node/bin/napi-v*/linux/x64/**/*',
      './node_modules/onnxruntime-node/dist/**/*',
    ]])),
  },
  outputFileTracingExcludes: {
    '/api/*': [
      '**/onnxruntime-node/bin/napi-v*/win32/**',
      '**/onnxruntime-node/bin/napi-v*/darwin/**',
      '**/onnxruntime-node/bin/napi-v*/linux/arm64/**',
      '**/onnxruntime-node/bin/napi-v*/linux/x64/libonnxruntime_providers_cuda*',
      '**/onnxruntime-node/bin/napi-v*/linux/x64/libonnxruntime_providers_tensorrt*',
      './quantum_lab/**', './artifacts/**', './qiskit_train/**', './offline_handlers/**', './python_quantum/**', './cloud_worker/**', './tests/**', './docs/**',
    ],
    '/api/*/*': [
      '**/onnxruntime-node/**',
      './quantum_lab/**', './artifacts/**', './qiskit_train/**', './offline_handlers/**', './python_quantum/**', './cloud_worker/**', './tests/**', './docs/**',
    ],
  },
};

export default nextConfig;
