import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'templates', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/templates/hub/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        localStorage: 'readonly',
        confirm: 'readonly',
        requestAnimationFrame: 'readonly',
        idMap: 'readonly',
        projectId: 'readonly',
        mermaid: 'readonly',
        marked: 'readonly',
        svgPanZoom: 'readonly',
        HTMLElement: 'readonly',
        CustomEvent: 'readonly',
        customElements: 'readonly',
      }
    }
  }
);
