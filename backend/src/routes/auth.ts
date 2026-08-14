import { Router } from 'express';
import { InvalidCredentialsError, loginWithPassword } from '../services/authService';

function serializeUser(user: {
  id: bigint;
  householdId: bigint;
  email: string;
  displayName: string;
  colorCode: string | null;
}) {
  return {
    id: user.id.toString(),
    householdId: user.householdId.toString(),
    email: user.email,
    displayName: user.displayName,
    colorCode: user.colorCode,
  };
}

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email, passwordは必須です' });
    return;
  }
  try {
    const { token, user } = await loginWithPassword(email, password);
    res.json({ accessToken: token, user: serializeUser(user) });
  } catch (e) {
    if (e instanceof InvalidCredentialsError) {
      res.status(401).json({ error: e.message });
      return;
    }
    throw e;
  }
});
