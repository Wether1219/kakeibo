import { prisma } from '../prisma';

export async function listUsers(householdId: bigint) {
  return prisma.user.findMany({
    where: { householdId },
    orderBy: { id: 'asc' },
  });
}
