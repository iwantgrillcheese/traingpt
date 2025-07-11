import js from '@eslint/js';
import next from 'eslint-config-next';

export default [
  js.configs.recommended,
  ...next(),
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      'react/jsx-key': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
];
