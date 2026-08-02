import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const email = process.env.RESET_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.RESET_ADMIN_PASSWORD;
const confirmation = process.env.CONFIRM_RESET_ADMIN;
const listOnly = process.argv.includes('--list');

const prisma = new PrismaClient();
try {
  if (listOnly) {
    const users = await prisma.adminUser.findMany({ where: { isActive: true }, select: { email: true }, orderBy: { email: 'asc' } });
    for (const user of users) console.log(user.email);
    process.exitCode = users.length ? 0 : 1;
  } else {
    if (confirmation !== 'YES') throw new Error('Set CONFIRM_RESET_ADMIN=YES to reset an administrator.');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('RESET_ADMIN_EMAIL must be a valid email address.');
    if (!password || password.length < 14) throw new Error('RESET_ADMIN_PASSWORD must be at least 14 characters.');

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (!existing || !existing.isActive) throw new Error('No active administrator exists with that email.');

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.adminUser.update({ where: { id: existing.id }, data: { passwordHash } }),
      prisma.adminSession.deleteMany({ where: { adminUserId: existing.id } })
    ]);
    console.log(`Reset administrator ${existing.email}; existing sessions were revoked.`);
  }
} finally {
  await prisma.$disconnect();
}
