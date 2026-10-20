import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Module boundaries (see docs/ARCHITECTURE.md §2).
 * Cross-module imports must use the `@/` alias so these rules can see them.
 * Type-only imports are always allowed: they vanish at build time.
 */
const THREE = { group: ['three', 'three/*'], message: 'Only src/render may import Three.js.' };
const RAPIER = { group: ['@dimforge/*'], message: 'Only src/physics may import Rapier.' };
const REACT = {
  group: ['react', 'react-dom', 'react-dom/*', 'react/*'],
  message: 'React belongs to src/app and src/ui only.',
};
const ZUSTAND_REACT = {
  group: ['zustand', 'zustand/react'],
  message: 'Use zustand/vanilla outside React code.',
};

function only(allowed) {
  return {
    group: ['@/*', ...allowed.map((m) => `!@/${m}`), ...allowed.map((m) => `!@/${m}/**`)],
    message: `This module may only import from: ${allowed.join(', ')}.`,
  };
}

function boundary(files, patterns) {
  return {
    files,
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: patterns.map((p) => ({ ...p, allowTypeImports: true })) },
      ],
    },
  };
}

const SIM = ['core', 'physics', 'robot', 'game', 'field', 'input', 'auto', 'net', 'settings'];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Hot loops index arrays directly to avoid iterator allocation; with
      // noUncheckedIndexedAccess that requires `!` on in-bounds reads.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}', 'src/main.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  { files: ['*.config.{js,ts}'], languageOptions: { globals: globals.node } },

  boundary(['src/core/**'], [THREE, RAPIER, REACT, ZUSTAND_REACT, only(['core'])]),
  boundary(['src/settings/**'], [THREE, RAPIER, REACT, ZUSTAND_REACT, only(['core', 'settings'])]),
  boundary(['src/physics/**'], [THREE, REACT, ZUSTAND_REACT, only(['core', 'physics'])]),
  boundary(
    ['src/{robot,game,field,input,auto,net}/**'],
    [THREE, RAPIER, REACT, ZUSTAND_REACT, only(SIM)],
  ),
  boundary(['src/render/**'], [RAPIER, REACT, ZUSTAND_REACT, only(['core', 'render', 'settings'])]),
  boundary(['src/state/**'], [THREE, RAPIER, REACT, only(['core', 'state', 'settings'])]),
  boundary(
    ['src/engine/**'],
    [THREE, RAPIER, REACT, ZUSTAND_REACT, only([...SIM, 'render', 'state', 'engine'])],
  ),
  boundary(
    ['src/{app,ui}/**'],
    [THREE, RAPIER, only(['core', 'state', 'settings', 'engine', 'ui', 'app'])],
  ),
);
