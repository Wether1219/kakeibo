type Transaction = {
  amount: number;
  category?: string;
  type?: 'income' | 'expense';
  date?: string;
};

export function calcMonthlySummary(transactions: Transaction[]) {
  const summary: Record<string, number> = {};
  for (const t of transactions) {
    const cat = t.category ?? 'その他';
    summary[cat] = (summary[cat] || 0) + t.amount;
  }
  return summary;
}
