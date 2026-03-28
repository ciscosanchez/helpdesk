"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";

interface TicketActionsProps {
  ticket: {
    id: string;
    subject: string;
    fromEmail: string;
    fromName: string | null;
    draftReply: string | null;
    autoAction: string | null;
    sentAt: string | null;
    zammadTicketId: number;
  };
}

export function TicketActions({ ticket }: TicketActionsProps) {
  const router = useRouter();
  const [reply, setReply] = useState(ticket.draftReply ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSent = !!ticket.sentAt;
  const isAutoHandled = ticket.autoAction !== "pending_human";

  if (isSent || isAutoHandled) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="text-sm font-medium text-gray-700">Reply</h2>
        {ticket.draftReply ? (
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-4">
            {ticket.draftReply}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {ticket.autoAction === "auto_closed" ? "Ticket was auto-closed (junk). No reply sent." : "No reply."}
          </p>
        )}
        {isSent && (
          <p className="text-xs text-green-700">
            ✓ Reply sent to {ticket.fromEmail}
          </p>
        )}
      </div>
    );
  }

  async function handleApprove(closeAfter: boolean) {
    if (!reply.trim()) {
      setError("Reply cannot be empty.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply, closeAfter }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send reply.");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">
          Draft Reply
          <span className="ml-2 text-xs text-gray-400 font-normal">to: {ticket.fromEmail}</span>
        </h2>
        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">AI Draft</span>
      </div>

      <Textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={12}
        className="font-mono text-sm resize-y"
        placeholder="Type your reply..."
      />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <Button
          onClick={() => handleApprove(true)}
          disabled={loading}
          className="bg-green-700 hover:bg-green-800 text-white"
        >
          {loading ? "Sending…" : "✓ Approve & Send (close ticket)"}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleApprove(false)}
          disabled={loading}
        >
          Send (keep open)
        </Button>
        <Button
          variant="ghost"
          onClick={() => setReply("")}
          disabled={loading}
          className="text-gray-400 hover:text-red-600 ml-auto"
        >
          Discard draft
        </Button>
      </div>
    </div>
  );
}
