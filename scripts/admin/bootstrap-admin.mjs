import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const confirmation = process.env.CONFIRM_BOOTSTRAP_ADMIN;

if (confirmation !== 'YES') throw new Error('Set CONFIRM_BOOTSTRAP_ADMIN=YES to create an administrator.');
if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email address.');
if (!password || password.length < 14) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 14 characters.');

const prisma = new PrismaClient();
try {
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) throw new Error('An administrator with that email already exists; refusing to overwrite it.');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.adminUser.create({ data: { email, passwordHash, name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || null } });
  console.log(`Created administrator ${user.email}. The password was not printed.`);
} finally {
  await prisma.$disconnect();
}

