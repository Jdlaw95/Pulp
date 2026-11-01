import { hasServiceKey, serverDb } from "./supabase";

export type Bank = { name: string; accountName: string; accountNumber: string; branchCode: string };

export const envBank = (): Bank => ({
  name: process.env.BANK_NAME || "",
  accountName: process.env.BANK_ACCOUNT_NAME || "",
  accountNumber: process.env.BANK_ACCOUNT_NUMBER || "",
  branchCode: process.env.BANK_BRANCH_CODE || "",
});

type Row = { bank_name?: string | null; bank_account_name?: string | null; bank_account_number?: string | null; bank_branch_code?: string | null };

/** Dashboard values win over the .env values. Private table is only readable with the service key or an admin login. */
export function mergeBank(row: Row | null | undefined): Bank {
  const e = envBank();
  return {
    name: row?.bank_name || e.name,
    accountName: row?.bank_account_name || e.accountName,
    accountNumber: row?.bank_account_number || e.accountNumber,
    branchCode: row?.bank_branch_code || e.branchCode,
  };
}

/** For order emails. Falls back to the .env values if the private table is not set up or no service key is available. */
export async function getBankDetails(): Promise<Bank> {
  if (!hasServiceKey()) return envBank();
  try {
    const { data, error } = await serverDb().from("shop_private").select("*").eq("id", 1).maybeSingle();
    if (error) return envBank();
    return mergeBank(data);
  } catch {
    return envBank();
  }
}
