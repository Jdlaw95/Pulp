import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export function hashCode(code: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(code, salt, 32).toString("hex")}`;
}

export function verifyCode(code: string, stored: string | null | undefined): boolean {
  const [kind, salt, hash] = (stored ?? "").split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(code, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

// "Unlocked" is a short-lived cookie signed with the stored code hash, so changing the code locks everything again.
const COOKIE = "pulp_unlock";
const MINUTES = 10;
const sign = (pinHash: string, exp: number, userId: string) => createHmac("sha256", pinHash).update(`${exp}.${userId}`).digest("hex");

export async function isUnlocked(pinHash: string | null | undefined, userId: string): Promise<boolean> {
  if (!pinHash) return false;
  const v = (await cookies()).get(COOKIE)?.value ?? "";
  const [expStr, sig] = v.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now()) return false;
  const want = Buffer.from(sign(pinHash, exp, userId));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function setUnlocked(pinHash: string, userId: string) {
  const exp = Date.now() + MINUTES * 60_000;
  (await cookies()).set(COOKIE, `${exp}.${sign(pinHash, exp, userId)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: MINUTES * 60,
  });
}

export async function clearUnlocked() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}
