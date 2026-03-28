import { AccessRequestForm } from "./access-request-form";

export const metadata = {
  title: "Request System Access – Armstrong IT",
};

export default function RequestPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Request System Access</h1>
          <p className="text-sm text-gray-500 mt-2">
            Need access to an Armstrong system? Fill out this form instead of emailing IT.
            Your manager will be notified automatically for approval.
          </p>
        </div>
        <AccessRequestForm />
        <p className="text-xs text-gray-400 mt-6 text-center">
          For urgent issues, email <a href="mailto:helpdesk@goarmstrong.com" className="underline">helpdesk@goarmstrong.com</a>
        </p>
      </div>
    </div>
  );
}
