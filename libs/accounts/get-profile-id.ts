import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { auth } from "@/libs/next-auth";

export async function getAuthenticatedProfileId(): Promise<string | null> {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  await connectMongo();
  const user = await User.findOne({ email: session.user.email });

  if (!user) {
    return null;
  }

  return user._id.toString();
}
