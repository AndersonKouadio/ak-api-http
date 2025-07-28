import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import jest from "eslint-plugin-jest"; // Pour les règles spécifiques à Jest

export default [
  // 1. Configuration de base d'ESLint (règles recommandées pour JavaScript)
  pluginJs.configs.recommended,

  // 2. Configurations TypeScript
  // Utilise les configurations recommandées et de style pour TypeScript
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,

  // 3. Configuration spécifique pour les fichiers de test Jest
  {
    // Cible uniquement les fichiers de test
    files: ["**/*.test.ts", "**/*.spec.ts"],
    // Active les globales de Jest (describe, it, expect, etc.)
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    // Applique les règles recommandées de eslint-plugin-jest (plat)
    // Assurez-vous d'avoir installé 'eslint-plugin-jest'
    ...jest.configs["flat/recommended"],
    rules: {
      // Désactive certaines règles de Jest si elles sont trop strictes pour votre flux de travail
      // Par exemple, vous pourriez vouloir autoriser `it.only` ou `describe.only` pendant le développement
      "jest/no-focused-tests": "warn", // Avertit au lieu d'erreur pour .only
      "jest/no-disabled-tests": "warn", // Avertit pour .skip
      // Si vous utilisez `await` dans un test qui n'est pas `async`, Zod ou d'autres lib peuvent lancer une promesse.
      // Cela peut être un faux positif, donc on peut le désactiver si nécessaire
      // "@typescript-eslint/require-await": "off",
    },
  },

  // 4. Configuration globale pour le projet
  {
    // Cible tous les fichiers TypeScript dans le répertoire src
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser, // Utilise le parseur TypeScript
      parserOptions: {
        ecmaVersion: "latest", // Dernière version d'ECMAScript
        sourceType: "module", // Utilise les modules ES (import/export)
        project: "./tsconfig.types.json", // **TRÈS IMPORTANT** pour les règles qui nécessitent des informations de type
        // Permet l'analyse de JSX si votre librairie devait inclure des composants (peu probable ici)
        // ecmaFeatures: { jsx: true },
      },
      // Définir les globales de l'environnement (Node.js et navigateur)
      globals: {
        ...globals.browser, // Pour window, document, console, etc. (utile pour `FormData`, `Blob`, `File`)
        ...globals.node,    // Pour process, require, module, etc.
      },
    },
    rules: {
      // Règles TypeScript spécifiques
      "@typescript-eslint/no-explicit-any": "warn", // Avertit si vous utilisez `any`
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }], // Avertit pour les variables non utilisées (ignore celles qui commencent par `_`)
      // Exemple de règles ESLint natives
      "no-console": "warn", // Avertit en cas d'utilisation de console.log
      "prefer-const": "error", // Force l'utilisation de const quand possible
      "quotes": ["error", "single"], // Utilise des guillemets simples
      "semi": ["error", "always"], // Force l'utilisation des points-virgules
      "indent": ["error", 2, { "SwitchCase": 1 }], // Indentation de 2 espaces, 1 niveau pour les switch
    },
  },

  {
    ignores: [
      "node_modules/",
      "dist/",
      "coverage/",
      "**/*.js",
    ],
  },
];