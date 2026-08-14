import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconPicker } from './IconPicker';
import { CATEGORY_ICON_OPTIONS } from '../constants/categoryIcons';

describe('IconPicker', () => {
  it('現在のアイコンをボタンに表示する', () => {
    render(<IconPicker value="🍙" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'アイコンを選択' })).toHaveTextContent('🍙');
  });

  it('未設定の場合は「？」を表示する', () => {
    render(<IconPicker value="" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'アイコンを選択' })).toHaveTextContent('？');
  });

  it('ボタンをクリックすると候補一覧が開き、選択するとonChangeが呼ばれて閉じる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value="" onChange={onChange} />);

    expect(screen.queryByPlaceholderText('自由入力')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'アイコンを選択' }));
    expect(screen.getByPlaceholderText('自由入力')).toBeInTheDocument();

    const firstIcon = CATEGORY_ICON_OPTIONS[0];
    await user.click(screen.getByRole('button', { name: firstIcon }));

    expect(onChange).toHaveBeenCalledWith(firstIcon);
    expect(screen.queryByPlaceholderText('自由入力')).not.toBeInTheDocument();
  });

  it('自由入力欄からも絵文字以外を含む任意の文字を設定できる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value="" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'アイコンを選択' }));
    await user.type(screen.getByPlaceholderText('自由入力'), '★');
    await user.click(screen.getByRole('button', { name: '決定' }));

    expect(onChange).toHaveBeenCalledWith('★');
  });
});
