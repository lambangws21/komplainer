import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  { ignores: [".next/**", ".next-dev/**", ".vercel/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"] },
  { files: ["**/*.{js,jsx,ts,tsx}"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { files: ["src/app/komplain/**/*.jsx"], rules: { "no-undef": "error" } },
];

export default eslintConfig;
