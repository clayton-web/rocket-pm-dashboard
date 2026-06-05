import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authorizeStaffCredentials } from "@/lib/auth/authorize-credentials";
import {
  logGoogleSignInDeniedInactive,
  logGoogleSignInExistingUser,
  logGoogleSignInStart,
  logGoogleSignInUpsertError,
  logGoogleSignInUpsertStart,
  logGoogleSignInUpsertSuccess,
} from "@/lib/auth/google-signin-diagnostic-log";
import { withPrismaConnectionRetry } from "@/lib/db/prisma-retry";
import prisma from "@/lib/db/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: authorizeStaffCredentials,
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google" && profile && "email" in profile && profile.email) {
        const email = profile.email as string;
        logGoogleSignInStart({ provider: account.provider, email });

        try {
          const existing = await withPrismaConnectionRetry(() =>
            prisma.user.findUnique({ where: { email } }),
          );
          logGoogleSignInExistingUser({
            email,
            found: Boolean(existing),
            userId: existing?.id,
            isActive: existing?.isActive,
          });

          if (existing && !existing.isActive) {
            logGoogleSignInDeniedInactive({ email, userId: existing.id });
            return false;
          }

          const name = "name" in profile && typeof profile.name === "string" ? profile.name : null;
          const image =
            "picture" in profile && typeof profile.picture === "string" ? profile.picture : null;

          logGoogleSignInUpsertStart({ email });
          await withPrismaConnectionRetry(() =>
            prisma.user.upsert({
              where: { email },
              create: { email, name, image, isActive: true },
              update: { name: name ?? undefined, image: image ?? undefined },
            }),
          );
          logGoogleSignInUpsertSuccess({ email });
        } catch (error) {
          logGoogleSignInUpsertError({ email, error });
          throw error;
        }
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" && profile && "email" in profile && profile.email) {
        const email = (profile.email as string).trim().toLowerCase();
        const dbUser = await withPrismaConnectionRetry(() =>
          prisma.user.findUnique({ where: { email } }),
        );
        if (dbUser?.isActive) {
          token.sub = dbUser.id;
        }
        return token;
      }

      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
