import nextVitals from "eslint-config-next/core-web-vitals";

export default [
  { ignores: ["**/.next/**", "**/dist/**", "**/src/generated/**", "**/coverage/**", "**/._*"] },
  ...nextVitals,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
