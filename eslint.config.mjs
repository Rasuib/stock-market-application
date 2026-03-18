import nextConfig from "eslint-config-next";

// nextConfig is a flat config array from eslint-config-next@16
// Config[0] = "next" (react, import, jsx-a11y, @next/next plugins)
// Config[1] = "next/typescript" (@typescript-eslint plugin)
// Config[2] = ignores

const [nextBase, nextTS, ...rest] = nextConfig;

const eslintConfig = [
  {
    ...nextBase,
    rules: {
      ...nextBase.rules,
      // localStorage hydration in useEffect is a standard React pattern;
      // the strict rule flags all setState calls inside effects, which is
      // too aggressive for external-store-loading code.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    ...nextTS,
    rules: {
      ...nextTS.rules,
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  ...rest,
];

export default eslintConfig;
