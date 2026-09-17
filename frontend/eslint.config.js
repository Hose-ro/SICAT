import js from '@eslint/js'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'test-results', 'playwright-report', 'audit']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'jsx-a11y/label-has-associated-control': ['error', { depth: 3 }],
      // Scrollable data regions (tables wider than the viewport) need a tab
      // stop so keyboard users can scroll them — axe: scrollable-region-focusable.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['tabpanel', 'region'] }],
      'no-restricted-globals': ['error', 'alert', 'confirm'],
      'no-restricted-properties': ['error', { object: 'window', property: 'alert' }, { object: 'window', property: 'confirm' }],
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Usar un const/let antes de su declaración revienta en runtime pero
      // compila sin quejas: esbuild no analiza la zona muerta temporal.
      'no-use-before-define': [
        'error',
        { functions: false, classes: true, variables: true },
      ],
    },
  },
])
