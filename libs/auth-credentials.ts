import bcrypt from "bcryptjs";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

const MIN_PASSWORD_LENGTH = 8;

export async function findUserByEmailWithPassword(email: string) {
  await connectMongo();
  return User.findOne({ email: email.toLowerCase().trim() }).select("+password");
}

export async function verifyUserPassword(
  email: string,
  password: string
): Promise<{ id: string; email: string; name?: string; image?: string; hasAccess: boolean } | null> {
  const user = await findUserByEmailWithPassword(email);

  if (!user?.password) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return null;
  }

  return {
    id: user._id!.toString(),
    email: user.email!,
    name: user.name ?? undefined,
    image: user.image ?? undefined,
    hasAccess: user.hasAccess ?? false,
  };
}

export async function registerUserWithPassword(input: {
  email: string;
  password: string;
  name?: string;
}) {
  const email = input.email.toLowerCase().trim();
  const password = input.password;

  if (!email || !password) {
    throw new Error("Email y contraseña son obligatorios");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }

  await connectMongo();

  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error("Este email ya está registrado");
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await User.create({
    email,
    name: input.name?.trim() || email.split("@")[0],
    password: hashedPassword,
    hasAccess: true,
  });

  return {
    id: user._id!.toString(),
    email: user.email!,
    name: user.name ?? undefined,
    hasAccess: user.hasAccess ?? false,
  };
}
