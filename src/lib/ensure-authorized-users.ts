import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/bcrypt";
import { AUTHORIZED_USERS } from "@/lib/authorized-users";

const DEFAULT_PASSWORD = process.env.AUTHORIZED_USER_DEFAULT_PASSWORD ?? "Lexcore@2026!";

export async function ensureAuthorizedUsers() {
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  for (const member of AUTHORIZED_USERS) {
    await prisma.user.upsert({
      where: { email: member.email },
      update: {
        fullName: member.name,
        role: "super_admin",
        isActive: true,
        company: "Lexcore Solutions",
        designation: member.roleTitle
      },
      create: {
        fullName: member.name,
        email: member.email,
        passwordHash,
        role: "super_admin",
        company: "Lexcore Solutions",
        designation: member.roleTitle,
        isActive: true
      }
    });
  }
}
