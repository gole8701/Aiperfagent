import js from '@eslint/js'
import importX from 'eslint-plugin-import-x'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Packages may only depend "downwards". The order here is the allowed import direction.
const layers = [
  ['core'],
  ['config', 'report-schema', 'security'],
  ['collectors', 'importers', 'scanner', 'rules'],
  ['engine'],
  ['server', 'ai', 'fixer', 'mcp'],
  ['cli'],
]
const layerOf = (name) => layers.findIndex((layer) => layer.includes(name))

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.*', 'fixtures/reports/**', 'scripts/**'],
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
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': ['error', { allow: ['error'] }],
      'import-x/no-cycle': 'error',
      'import-x/order': ['error', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['**/dist/*'], message: 'Import the package, not its build output.' }],
        },
      ],
    },
  },
  {
    files: ['packages/*/src/**/*.ts'],
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
    files: ['packages/*/src/**/*.ts'],
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
    files: ['packages/*/src/**/*.ts'],
    rules: { 'perfagent/layer-direction': 'error' },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/test/**'],
    rules: { '@typescript-eslint/no-unsafe-assignment': 'off', '@typescript-eslint/no-unsafe-member-access': 'off' },
  },
)
