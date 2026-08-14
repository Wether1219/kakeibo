import { Router } from 'express';
import multer from 'multer';
import { HouseholdRequest, authMiddleware } from '../middlewares/household';
import { runImportBuffer } from '../migration/runImport';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const importRouter = Router();

// multerを先に実行してリクエストボディ（ファイル）を読み切ってから認証チェックする。
// authMiddlewareを先にすると、未認証で401を返した際にクライアントがファイル送信中でも
// サーバーがボディを読まずに応答してしまいECONNRESETになるため。
importRouter.post('/excel', upload.single('file'), authMiddleware, async (req: HouseholdRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'fileは必須です' });
    return;
  }
  try {
    const summary = await runImportBuffer(req.file.buffer, req.householdId!);
    res.json(summary);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '取込に失敗しました' });
  }
});
