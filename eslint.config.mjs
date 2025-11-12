// ESLint flat config for Next.js 15
// Next.js handles ESLint configuration internally during build
export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "node_modules/**",
    ],
  },
  // Next.js will use its own ESLint config during build
  // This file is just to satisfy the flat config requirement
];
