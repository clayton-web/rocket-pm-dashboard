import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import prisma from "@/lib/db/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Development",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (process.env.DEV_CREDENTIALS_LOGIN !== "true") {
          return null;
        }
        const email = credentials?.email as string | undefined;
        if (!email) {
          return null;
        }
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return null;
        }
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
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
        const name = "name" in profile && typeof profile.name === "string" ? profile.name : null;
        const image =
          "picture" in profile && typeof profile.picture === "string" ? profile.picture : null;
        await prisma.user.upsert({
          where: { email },
          create: { email, name, image },
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
        if (dbUser) {
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
