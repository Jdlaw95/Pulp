import { requireAdmin } from "../../../lib/auth";
import { getBlackoutDates, getSettings } from "../../../lib/settings";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  await requireAdmin();
  const [settings, blackouts] = await Promise.all([getSettings(), getBlackoutDates()]);
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Settings</h1>
      <SettingsForm settings={settings} blackouts={blackouts} />
    </div>
  );
}
