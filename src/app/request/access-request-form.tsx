"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SYSTEMS = [
  "ARCC",
  "Converge Marketplace",
  "Converge Move",
  "VersaPay",
  "Flow WMS",
  "Bookstack (Internal Wiki)",
  "Local Dispatch",
  "NetSuite",
  "CargoWise",
  "Microsoft 365 / Email",
  "OneDrive / SharePoint",
  "Other",
];

type FormState = "idle" | "loading" | "success" | "error";

export function AccessRequestForm() {
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({
    requesterName: "",
    requesterEmail: "",
    systemNeeded: "",
    reason: "",
    managerEmail: "",
  });

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong.");
      }

      setState("success");
    } catch (err) {
      setErrorMsg((err as Error).message);
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="bg-white rounded-xl border border-green-200 p-8 text-center space-y-3">
        <div className="text-3xl">✓</div>
        <h2 className="text-lg font-semibold text-gray-900">Request Submitted</h2>
        <p className="text-sm text-gray-500">
          We&apos;ve notified your manager for approval. You&apos;ll receive a confirmation email shortly.
          IT will set up your access within 1 business day of approval.
        </p>
        <button
          onClick={() => { setState("idle"); setForm({ requesterName: "", requesterEmail: "", systemNeeded: "", reason: "", managerEmail: "" }); }}
          className="text-sm text-blue-600 hover:underline mt-2"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="requesterName">Your Name</Label>
          <Input id="requesterName" placeholder="Jane Smith" required value={form.requesterName} onChange={(e) => update("requesterName", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="requesterEmail">Your Armstrong Email</Label>
          <Input id="requesterEmail" type="email" placeholder="jane@goarmstrong.com" required value={form.requesterEmail} onChange={(e) => update("requesterEmail", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="systemNeeded">System / Application Needed</Label>
        <select
          id="systemNeeded"
          required
          value={form.systemNeeded}
          onChange={(e) => update("systemNeeded", e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Select a system…</option>
          {SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason">Why do you need access?</Label>
        <Textarea
          id="reason"
          placeholder="Describe your role and what you need to do with this system…"
          required
          rows={3}
          value={form.reason}
          onChange={(e) => update("reason", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="managerEmail">Your Manager&apos;s Email</Label>
        <Input id="managerEmail" type="email" placeholder="manager@goarmstrong.com" required value={form.managerEmail} onChange={(e) => update("managerEmail", e.target.value)} />
        <p className="text-xs text-gray-400">Your manager will receive an approval request via email.</p>
      </div>

      {state === "error" && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}

      <Button type="submit" disabled={state === "loading"} className="w-full">
        {state === "loading" ? "Submitting…" : "Submit Access Request"}
      </Button>
    </form>
  );
}
