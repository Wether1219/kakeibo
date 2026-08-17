import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryTypeSection } from './CategoryTypeSection';
import type { Category } from '../api/categories';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: '1',
    householdId: '1',
    type: 'variable_expense',
    name: '食費',
    icon: '🍙',
    sortOrder: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CategoryTypeSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('無効化ボタン押下時に確認ダイアログを表示し、キャンセルするとonDeactivateを呼ばない', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onDeactivate = vi.fn();

    render(
      <CategoryTypeSection
        title="変動費"
        categories={[makeCategory()]}
        onRename={vi.fn()}
        onChangeIcon={vi.fn()}
        onDeactivate={onDeactivate}
        onReorder={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: '無効化' }));

    expect(window.confirm).toHaveBeenCalledWith('「食費」を無効化しますか？');
    expect(onDeactivate).not.toHaveBeenCalled();
  });

  it('確認ダイアログでOKするとonDeactivateが呼ばれる', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDeactivate = vi.fn();

    render(
      <CategoryTypeSection
        title="変動費"
        categories={[makeCategory()]}
        onRename={vi.fn()}
        onChangeIcon={vi.fn()}
        onDeactivate={onDeactivate}
        onReorder={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: '無効化' }));

    expect(onDeactivate).toHaveBeenCalledWith('1');
  });
});
