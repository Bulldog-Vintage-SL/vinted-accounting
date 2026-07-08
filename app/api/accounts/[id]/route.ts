import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return Response.json({ error: "No user" }, { status: 401 });
  }

  await connectMongo();
  const account = await Account.findOne({ _id: id, userId });

  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  return Response.json(account);
}
