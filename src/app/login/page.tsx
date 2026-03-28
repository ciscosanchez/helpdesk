import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 w-full max-w-sm text-center space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Armstrong IT</h1>
          <p className="text-sm text-gray-500 mt-1">Helpdesk Portal</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id");
          }}
        >
          <Button type="submit" className="w-full">
            Sign in with Microsoft
          </Button>
        </form>
      </div>
    </div>
  );
}
