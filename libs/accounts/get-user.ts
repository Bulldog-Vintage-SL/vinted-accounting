import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { auth } from "@/libs/next-auth";
import { verifyExtensionToken, getBearerToken } from "@/libs/extension-auth";

export async function getAuthenticatedUser() {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  await connectMongo();
  let user = await User.findOne({ email: session.user.email });

  if (!user) {
    user = await User.create({
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    });
  }

  return user;
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const user = await getAuthenticatedUser();
  return user?._id?.toString() ?? null;
}

export async function getUserFromRequest(req: Request) {
  const bearer = getBearerToken(req);
  const userId = verifyExtensionToken(bearer);

  if (!userId) {
    return null;
  }

  await connectMongo();
  return User.findById(userId);
}
