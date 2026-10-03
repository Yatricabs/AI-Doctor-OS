import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { queryOne } from "@/app/api/_lib/database";
import { logAuditAction } from "@/lib/audit";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "doctor@aiupchar.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await queryOne<{
          id: string;
          email: string;
          name: string;
          role: string;
          passwordHash: string;
          clinicId: string | null;
          isActive: number;
        }>("SELECT * FROM users WHERE email = ? LIMIT 1", [credentials.email]);

        if (!user || !user.isActive) {
          return null;
        }

        const isMatch = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isMatch) {
          return null;
        }

        // Log successful login
        const ip = req?.headers?.["x-forwarded-for"] || "unknown";
        await logAuditAction({
          userId: user.id,
          action: "LOGIN",
          entityType: "USER",
          entityId: user.id,
          ipAddress: Array.isArray(ip) ? ip[0] : ip,
        }).catch(err => console.error("Audit log failed:", err));

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicId: user.clinicId,
        };
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 Days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.clinicId = (user as any).clinicId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).clinicId = token.clinicId;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_development_only",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
