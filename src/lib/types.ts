export type TicketCategory =
  | "access_request"
  | "password_reset"
  | "software_howto"
  | "security_report"
  | "hardware"
  | "external_vendor"
  | "junk"
  | "billing_netsuite"
  | "email_issue"
  | "other";

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  access_request: "Access Request",
  password_reset: "Password Reset",
  software_howto: "Software How-To",
  security_report: "Security Report",
  hardware: "Hardware",
  external_vendor: "External Vendor",
  junk: "Junk",
  billing_netsuite: "Billing / NetSuite",
  email_issue: "Email Issue",
  other: "Other",
};

export const CATEGORY_COLORS: Record<TicketCategory, string> = {
  access_request: "bg-blue-100 text-blue-800",
  password_reset: "bg-purple-100 text-purple-800",
  software_howto: "bg-yellow-100 text-yellow-800",
  security_report: "bg-red-100 text-red-800",
  hardware: "bg-orange-100 text-orange-800",
  external_vendor: "bg-gray-100 text-gray-700",
  junk: "bg-gray-100 text-gray-400",
  billing_netsuite: "bg-green-100 text-green-800",
  email_issue: "bg-indigo-100 text-indigo-800",
  other: "bg-slate-100 text-slate-700",
};

export const PRIORITY_LABELS: Record<number, string> = {
  1: "P1 Critical",
  2: "P2 High",
  3: "P3 Normal",
  4: "P4 Low",
  5: "P5 Noise",
};

export const PRIORITY_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-yellow-100 text-yellow-800",
  4: "bg-blue-100 text-blue-800",
  5: "bg-gray-100 text-gray-500",
};

export interface TriagedTicketRow {
  id: string;
  zammadTicketId: number;
  ticketNumber: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  body: string;
  category: string;
  priority: number;
  confidence: number;
  draftReply: string | null;
  autoAction: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  sentAt: string | null;
  createdAt: string;
}
