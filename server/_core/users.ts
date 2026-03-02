import type { User } from "../../drizzle/schema";

export type SafeUser = Omit<User, "passwordHash">;

export function toSafeUser(user: User): SafeUser {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export function toSafeUsers(users: User[]) {
  return users.map(toSafeUser);
}
