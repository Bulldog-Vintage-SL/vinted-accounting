import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import config from "@/config";
import { ensureAuthUrl } from "@/libs/app-url";
import connectMongo from "./mongo";

ensureAuthUrl();

export const authOptions = {
  // Set any random key in .env.local
  secret: process.env.NEXTAUTH_SECRET,
  // Required for production deployments behind reverse proxy (Vercel, etc.)
  // Prevents "Host must be trusted" / server configuration errors
  trustHost: true,
  providers: [
    GoogleProvider({
      // Follow the "Login with Google" tutorial to get your credentials
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          // 'consent' is needed to always get refresh_token (important for Gmail API)
          // Google will only show consent screen on first login or if permissions changed
          prompt: "consent",
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.given_name ? profile.given_name : profile.name,
          email: profile.email,
          image: profile.picture,
          createdAt: new Date(),
        };
      },
    }),
    // Follow the "Login with Email" tutorial to set up your email server
    // Requires a MongoDB database. Set MONOGODB_URI env variable.
    ...(connectMongo
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
  // New users will be saved in Database (MongoDB Atlas). Each user (model) has some fields like name, email, image, etc..
  // Requires a MongoDB database. Set MONOGODB_URI env variable.
  // Learn more about the model type: https://next-auth.js.org/v3/adapters/models
  ...(connectMongo && { adapter: MongoDBAdapter(connectMongo) }),

  callbacks: {
    async jwt({ token, account, user }: any) {
      // Initial sign in - Store tokens
      if (account && user) {
        return {
          ...token,
          sub: user.id, // Required for NextAuth v5 - user identifier
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at * 1000, // Convert to milliseconds
        };
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < token.accessTokenExpires - 5 * 60 * 1000) { // Refresh 5 min before expiry
        return token;
      }

      // Access token has expired, try to refresh it
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
          accessTokenExpires: credentials.expiry_date || Date.now() + 3600 * 1000,
          // Refresh token is usually returned only once, keep the old one
          refreshToken: credentials.refresh_token ?? token.refreshToken,
        };
      } catch (error) {
        console.error("Error refreshing access token:", error);
        // Return the old token with an error flag
        return {
          ...token,
          error: "RefreshAccessTokenError",
        };
      }
    },
    session: async ({ session, token }: any) => {
      if (session?.user) {
        session.user.id = token.sub;
        // Add tokens to session for API routes
        session.accessToken = token.accessToken;
        session.refreshToken = token.refreshToken;
        session.accessTokenExpires = token.accessTokenExpires;
        session.error = token.error;
        // All users have sync access
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
    // Add you own logo below. Recommended size is rectangle (i.e. 200x50px) and show your logo + name.
    // It will be used in the login flow to display your logo. If you don't add it, it will look faded.
    logo: `https://${config.domainName}/icon.png`,
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
