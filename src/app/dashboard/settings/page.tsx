import { getAllSettingStatuses } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const statuses = await getAllSettingStatuses();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure API credentials. Values saved here are stored in the database and
          take priority over <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">.env</code> variables.
        </p>
      </div>
      <SettingsForm initialStatuses={statuses} />
    </div>
  );
}
