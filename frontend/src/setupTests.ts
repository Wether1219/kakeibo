import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// vitest.config.tsでtest.globals: trueにしていないため、
// @testing-library/reactの自動クリーンアップ検出が効かない。明示的に登録する。
afterEach(() => {
  cleanup();
});
