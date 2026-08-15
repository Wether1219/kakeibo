import { useEffect, useState } from 'react';
import { AssetGroup, createAsset } from '../api/assets';
import { fetchUsers, User } from '../api/users';
import { useModalA11y } from '../hooks/useModalA11y';
import { ErrorMessage } from './StatusMessage';

interface Props {
  assetGroup: AssetGroup;
  onClose: () => void;
  onCreated: () => void;
}

export function AddAssetModal({ assetGroup, onClose, onCreated }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [detail, setDetail] = useState('');
  const [purpose, setPurpose] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useModalA11y(onClose);

  useEffect(() => {
    fetchUsers()
      .then((list) => {
        setUsers(list);
        if (list.length > 0) setOwnerUserId(list[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() === '' || ownerUserId === '') {
      setError('名称と名義は必須です');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAsset({
        assetGroup,
        name: name.trim(),
        ownerUserId,
        detail: detail.trim() || undefined,
        purpose: purpose.trim() || undefined,
        monthlyContribution:
          monthlyContribution.trim() === '' ? undefined : Number(monthlyContribution),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-asset-title"
        tabIndex={-1}
        className="bg-white dark:bg-gray-800 rounded shadow-lg w-full max-w-sm p-4"
      >
        <h2 id="add-asset-title" className="text-lg font-bold mb-4">
          口座追加
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">名称</label>
            <input
              type="text"
              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">名義</label>
            <select
              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">詳細</label>
            <input
              type="text"
              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">用途</label>
            <input
              type="text"
              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">積立額</label>
            <input
              type="number"
              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(e.target.value)}
            />
          </div>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={onClose}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '追加中...' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
