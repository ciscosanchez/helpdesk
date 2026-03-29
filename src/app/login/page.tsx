import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const isAzureConfigured =
  !!process.env.AZURE_AD_CLIENT_ID &&
  !!process.env.AZURE_AD_CLIENT_SECRET &&
  !!process.env.AZURE_AD_ISSUER;

const isDev = process.env.NODE_ENV === "development";
const showDevLogin = isDev && !isAzureConfigured;

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 w-full max-w-sm text-center space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Armstrong IT</h1>
          <p className="text-sm text-gray-500 mt-1">Helpdesk Portal</p>
        </div>

        {isAzureConfigured && (
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
        )}

        {showDevLogin && (
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("dev-login", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo: "/dashboard",
              });
            }}
            className="space-y-3 text-left"
          >
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 text-center">
              Dev mode — Azure AD not configured
            </div>
            <Input name="email" type="email" placeholder="your@email.com" required />
            <Input name="password" type="password" placeholder="anything" required />
            <Button type="submit" className="w-full">
              Sign in (dev)
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
