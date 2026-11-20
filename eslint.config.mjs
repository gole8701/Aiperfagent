import js from '@eslint/js'
import importX from 'eslint-plugin-import-x'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Packages may only depend "downwards". The order here is the allowed import direction.
// agent is the dependency-free browser snippet; web (the dashboard bundle) sits low so it cannot pull in Node packages.
const layers = [
  ['core', 'agent'],
  ['config', 'report-schema', 'security'],
  ['scanner', 'web'],
  ['collectors', 'importers', 'rules'],
  ['engine'],
  ['server', 'ai', 'fixer', 'mcp'],
  ['cli'],
]
const layerOf = (name) => layers.findIndex((layer) => layer.includes(name))

export default tseslint.config(
  {
    // fixtures/ holds the deliberately slow demo shop and sample reports: test input, not our code.
    ignores: ['**/dist/**', '**/dist-static/**', '**/node_modules/**', '**/*.config.*', 'fixtures/**', 'scripts/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { 'import-x': importX },
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-unnecessary-condition': ['error', { allowConstantLoopConditions: true }],
      '@typescript-eslint/prefer-includes': 'off',
      // `a || b` on booleans and strings is intended: '' and false fall through.
      '@typescript-eslint/prefer-nullish-coalescing': ['error', { ignorePrimitives: { boolean: true, string: true } }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      // Its autofix turns `as T` into `!`, which the rule above forbids.
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      'no-console': ['error', { allow: ['error'] }],
      'import-x/no-cycle': 'error',
      'import-x/order': ['error', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['**/dist/*', '!@xyflow/react/dist/style.css'], message: 'Import the package, not its build output.' }],
        },
      ],
    },
  },
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportDeclaration[source.value=/^@perfagent\\//]',
          message: 'Checked by the layer rule below.',
        },
      ],
    },
  },
  {
    // Dependency direction between packages: a package may import only packages in a lower layer.
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
    plugins: {
      perfagent: {
        rules: {
          'layer-direction': {
            meta: { type: 'problem', schema: [] },
            create(context) {
              const file = context.filename.replace(/\\/g, '/')
              const match = /packages\/([^/]+)\/src\//.exec(file)
              if (!match) return {}
              const from = layerOf(match[1])
              return {
                ImportDeclaration(node) {
                  const target = /^@perfagent\/([^/]+)/.exec(String(node.source.value))
                  if (!target) return
                  const to = layerOf(target[1])
                  if (to >= 0 && from >= 0 && to >= from && target[1] !== match[1]) {
                    context.report({
                      node,
                      message: `"${match[1]}" may not import "${target[1]}": packages only depend downwards.`,
                    })
                  }
                },
              }
            },
          },
        },
      },
    },
  },
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
    rules: { 'perfagent/layer-direction': 'error' },
  },
  {
    // React components return JSX; spelling that out on every component adds noise, not safety.
    files: ['**/*.tsx'],
    rules: { '@typescript-eslint/explicit-module-boundary-types': 'off' },
  },
  {
    // Tests and .mjs scripts are linted without type information: they sit outside the package tsconfigs.
    files: ['**/*.test.ts', '**/*.test.tsx', '**/test/**', '**/e2e/**', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    rules: { ...tseslint.configs.disableTypeChecked.rules, '@typescript-eslint/explicit-module-boundary-types': 'off', 'no-console': 'off' },
  },
)
