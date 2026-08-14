import { Router } from 'express';
import { HouseholdRequest, authMiddleware } from '../middlewares/household';
import { listUsers } from '../services/userService';

function serializeUser(user: { id: bigint; householdId: bigint; displayName: string }) {
  return {
    id: user.id.toString(),
    householdId: user.householdId.toString(),
    displayName: user.displayName,
  };
}

export const usersRouter = Router();
usersRouter.use(authMiddleware);

usersRouter.get('/', async (req: HouseholdRequest, res) => {
  const users = await listUsers(req.householdId!);
  res.json(users.map(serializeUser));
});
