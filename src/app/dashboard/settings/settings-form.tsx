"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SettingKey } from "@/lib/settings";

type Statuses = Record<SettingKey, { source: "db" | "env" | "unset"; configured: boolean; value?: string }>;

interface SettingsFormProps {
  initialStatuses: Statuses;
}

// Human-readable labels + descriptions for each key
const FIELD_META: Record<SettingKey, { label: string; description: string; placeholder: string; sensitive: boolean }> = {
  ZAMMAD_URL: {
    label: "Zammad URL",
    description: "Base URL of your Zammad instance, no trailing slash.",
    placeholder: "https://helpdesk.goarmstrong.com",
    sensitive: false,
  },
  ZAMMAD_TOKEN: {
    label: "Zammad API Token",
    description: "From Zammad → Profile → Token Access. Needs ticket.agent permission.",
    placeholder: "••••••••••••••••",
    sensitive: true,
  },
  ZAMMAD_WEBHOOK_SECRET: {
    label: "Webhook Secret",
    description: "HMAC secret — must match exactly what's set in Zammad's webhook config.",
    placeholder: "••••••••••••••••",
    sensitive: true,
  },
  ANTHROPIC_API_KEY: {
    label: "Anthropic API Key",
    description: "From console.anthropic.com/settings/api-keys — used for Claude triage.",
    placeholder: "sk-ant-••••••••",
    sensitive: true,
  },
  RESEND_API_KEY: {
    label: "Resend API Key",
    description: "From resend.com — used to send manager approval and confirmation emails.",
    placeholder: "re_••••••••",
    sensitive: true,
  },
  RESEND_FROM: {
    label: "Email From Address",
    description: "Sender address for outgoing emails. Must be on your verified Resend domain.",
    placeholder: "IT Helpdesk <helpdesk@goarmstrong.com>",
    sensitive: false,
  },
};

const SECTIONS = [
  {
    title: "Zammad",
    description: "Connect to your Zammad ticket system.",
    keys: ["ZAMMAD_URL", "ZAMMAD_TOKEN", "ZAMMAD_WEBHOOK_SECRET"] as SettingKey[],
  },
  {
    title: "Claude AI",
    description: "Powers ticket triage and draft replies.",
    keys: ["ANTHROPIC_API_KEY"] as SettingKey[],
  },
  {
    title: "Email (Resend)",
    description: "Sends manager approval requests and requester confirmations.",
    keys: ["RESEND_API_KEY", "RESEND_FROM"] as SettingKey[],
  },
];

function SourceBadge({ source }: { source: "db" | "env" | "unset" }) {
  if (source === "db") return <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-md font-medium">Saved in DB</span>;
  if (source === "env") return <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">.env</span>;
  return <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-md">Not configured</span>;
}

export function SettingsForm({ initialStatuses }: SettingsFormProps) {
  const [values, setValues] = useState<Partial<Record<SettingKey, string>>>(() => {
    // Pre-fill non-sensitive values
    const initial: Partial<Record<SettingKey, string>> = {};
    for (const [key, status] of Object.entries(initialStatuses) as [SettingKey, Statuses[SettingKey]][]) {
      if (status.value) initial[key] = status.value;
    }
    return initial;
  });
  const [statuses, setStatuses] = useState(initialStatuses);
  const [show, setShow] = useState<Partial<Record<SettingKey, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  function set(key: SettingKey, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaveMsg(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    try {
      // Only send keys that have a non-empty value typed in
      const payload: Partial<Record<SettingKey, string>> = {};
      for (const [k, v] of Object.entries(values) as [SettingKey, string][]) {
        if (v.trim()) payload[k] = v.trim();
      }
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      // Refresh statuses from server
      const fresh = await fetch("/api/settings").then((r) => r.json());
      setStatuses(fresh);
      setSaveMsg({ type: "success", text: `Saved: ${data.saved.join(", ")}` });
      // Clear sensitive fields after save so they don't sit in the DOM
      const cleared = { ...values };
      for (const key of data.saved as SettingKey[]) {
        if (FIELD_META[key].sensitive) cleared[key] = "";
      }
      setValues(cleared);
    } catch {
      setSaveMsg({ type: "error", text: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestZammad() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/settings/test", { method: "POST" });
    const data = await res.json();
    setTestResult(data);
    setTesting(false);
  }

  return (
    <div className="space-y-6">
      {SECTIONS.map((section) => (
        <div key={section.title} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-800">{section.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {section.keys.map((key) => {
              const meta = FIELD_META[key];
              const status = statuses[key];
              const isShown = show[key];
              return (
                <div key={key} className="px-6 py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={key} className="text-sm font-medium text-gray-800">
                      {meta.label}
                    </Label>
                    <SourceBadge source={status.source} />
                  </div>
                  <p className="text-xs text-gray-500">{meta.description}</p>
                  <div className="flex gap-2">
                    <Input
                      id={key}
                      type={meta.sensitive && !isShown ? "password" : "text"}
                      value={values[key] ?? ""}
                      onChange={(e) => set(key, e.target.value)}
                      placeholder={
                        status.configured && meta.sensitive
                          ? "Leave blank to keep existing value"
                          : meta.placeholder
                      }
                      className="font-mono text-sm"
                      autoComplete="off"
                    />
                    {meta.sensitive && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
                      >
                        {isShown ? "Hide" : "Show"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Zammad connection test button */}
          {section.title === "Zammad" && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestZammad}
                disabled={testing}
              >
                {testing ? "Testing…" : "Test Connection"}
              </Button>
              {testResult && (
                <span className={`text-sm ${testResult.ok ? "text-green-700" : "text-red-600"}`}>
                  {testResult.ok ? `✓ ${testResult.message}` : `✗ ${testResult.error}`}
                </span>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Save bar */}
      <div className="flex items-center gap-4 pt-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </Button>
        {saveMsg && (
          <span className={`text-sm ${saveMsg.type === "success" ? "text-green-700" : "text-red-600"}`}>
            {saveMsg.type === "success" ? `✓ ${saveMsg.text}` : saveMsg.text}
          </span>
        )}
      </div>

      {/* Auth note */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Microsoft SSO credentials</strong> (Azure AD client ID, secret, tenant) cannot be
          managed here because they are required before you can log in. Set those in your{" "}
          <code className="bg-blue-100 px-1 rounded">.env</code> file or hosting environment variables.
        </p>
      </div>
    </div>
  );
}
