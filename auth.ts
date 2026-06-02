import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authorizeStaffCredentials } from "@/lib/auth/authorize-credentials";
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
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing && !existing.isActive) {
          return false;
        }
        const name = "name" in profile && typeof profile.name === "string" ? profile.name : null;
        const image =
          "picture" in profile && typeof profile.picture === "string" ? profile.picture : null;
        await prisma.user.upsert({
          where: { email },
          create: { email, name, image, isActive: true },
          update: { name: name ?? undefined, image: image ?? undefined },
        });
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (user?.id) {
        token.sub = user.id;
      } else if (account?.provider === "google" && profile && "email" in profile && profile.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: profile.email as string },
        });
        if (dbUser?.isActive) {
          token.sub = dbUser.id;
        }
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
