import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import config from "@/config";
import { ensureAuthEnv } from "@/libs/app-url";
import connectMongo from "./mongo";

ensureAuthEnv();

const hasEmailProvider =
  Boolean(connectMongo) && Boolean(process.env.RESEND_API_KEY);

export const authOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  debug: process.env.AUTH_DEBUG === "true",
  pages: {
    signIn: "/login",
    error: "/login",
  },
  cookies: {
    pkceCodeVerifier: {
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
      // Link Google sign-in to an existing account with the same verified email
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
      profile(profile) {
        return {
          name: profile.given_name ? profile.given_name : profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
    ...(hasEmailProvider
      ? [
          EmailProvider({
            server: {
              host: "smtp.resend.com",
              port: 465,
              auth: {
                user: "resend",
                pass: process.env.RESEND_API_KEY,
              },
            },
            from: config.resend.fromNoReply,
          }),
        ]
      : []),
  ],
  ...(connectMongo && {
    adapter: MongoDBAdapter(connectMongo, {
      collections: {
        // Avoid collision with models/Account.ts (Vinted/Wallapop marketplace accounts)
        Accounts: "auth_accounts",
      },
    }),
  }),

  callbacks: {
    async jwt({ token, account, user }: any) {
      if (account && user) {
        const expiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;

        return {
          ...token,
          sub: user.id,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: expiresAt,
        };
      }

      if (
        typeof token.accessTokenExpires === "number" &&
        Date.now() < token.accessTokenExpires - 5 * 60 * 1000
      ) {
        return token;
      }

      if (!token.refreshToken) {
        return token;
      }

      try {
        const { OAuth2Client } = await import("google-auth-library");

        const oauth2Client = new OAuth2Client(
          process.env.GOOGLE_ID,
          process.env.GOOGLE_SECRET
        );

        oauth2Client.setCredentials({
          refresh_token: token.refreshToken,
        });

        const { credentials } = await oauth2Client.refreshAccessToken();

        return {
          ...token,
          accessToken: credentials.access_token,
          accessTokenExpires:
            credentials.expiry_date || Date.now() + 3600 * 1000,
          refreshToken: credentials.refresh_token ?? token.refreshToken,
        };
      } catch (error) {
        console.error("Error refreshing access token:", error);
        return {
          ...token,
          error: "RefreshAccessTokenError",
        };
      }
    },
    session: async ({ session, token }: any) => {
      if (session?.user) {
        session.user.id = token.sub;
        session.accessToken = token.accessToken;
        session.refreshToken = token.refreshToken;
        session.accessTokenExpires = token.accessTokenExpires;
        session.error = token.error;
        session.user.hasAccess = true;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt" as const,
  },
  theme: {
    brandColor: config.colors.main,
    logo: `https://${config.domainName}/icon.png`,
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
