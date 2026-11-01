import { requireAdmin } from "../../../lib/auth";
import { getBlackoutDates, getSettings } from "../../../lib/settings";
import { isUnlocked } from "../../../lib/pin";
import { mergeBank } from "../../../lib/bank";
import SettingsForm from "./SettingsForm";
import ContactForm from "./ContactForm";
import BankSection from "./BankSection";

export default async function SettingsPage() {
  const { db, user } = await requireAdmin();
  const [settings, blackouts, priv] = await Promise.all([
    getSettings(),
    getBlackoutDates(),
    db.from("shop_private").select("*").eq("id", 1).maybeSingle(),
  ]);
  const row = priv.data as { pin_hash: string | null; bank_name?: string | null; bank_account_name?: string | null; bank_account_number?: string | null; bank_branch_code?: string | null } | null;
  const unlocked = await isUnlocked(row?.pin_hash, user.id);
  // Bank details only travel to the browser once the code has been entered.
  const bank = unlocked ? mergeBank(row) : null;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">Settings</h1>
      <SettingsForm settings={settings} blackouts={blackouts} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ContactForm contact={settings.contact} />
        <BankSection tableMissing={Boolean(priv.error)} hasCode={Boolean(row?.pin_hash)} bank={bank} />
      </div>
    </div>
  );
}
