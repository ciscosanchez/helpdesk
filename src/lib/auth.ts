import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";

const isAzureConfigured =
  !!process.env.AZURE_AD_CLIENT_ID &&
  !!process.env.AZURE_AD_CLIENT_SECRET &&
  !!process.env.AZURE_AD_ISSUER;

const isDev = process.env.NODE_ENV === "development";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ...(isAzureConfigured
      ? [
          MicrosoftEntraID({
            clientId: process.env.AZURE_AD_CLIENT_ID!,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
            issuer: process.env.AZURE_AD_ISSUER,
          }),
        ]
      : []),
    // Dev-only bypass: any password works, only active when Azure AD is not configured
    ...(isDev && !isAzureConfigured
      ? [
          Credentials({
            id: "dev-login",
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password (anything)", type: "password" },
            },
            async authorize(credentials) {
              if (!credentials?.email) return null;
              return {
                id: "dev-user",
                email: credentials.email as string,
                name: "Dev User",
              };
            },
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (token?.email) session.user.email = token.email as string;
      return session;
    },
  },
});
