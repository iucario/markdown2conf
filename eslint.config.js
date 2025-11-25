import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    ignores: ['**/*.config.js', '!**/eslint.config.js', 'dist/**/*.js'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node },
  },
  {
    extends: [tseslint.configs.recommended],
    rules: {
      'no-unused-vars': 'error',
      'no-undef': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
    ignores: ['**/*.config.js', '!**/eslint.config.js', 'dist/**'],
  },
])
