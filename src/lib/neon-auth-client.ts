import { createAuthClient } from "@neon/auth";

export const neonAuthClient = createAuthClient(
  process.env.NEXT_PUBLIC_NEON_AUTH_URL ||
    process.env.NEON_AUTH_BASE_URL ||
    "https://auth.neon.tech"
);

export async function signUpWithEmail(params: {
  email: string;
  password: string;
  name?: string;
  callbackURL?: string;
}) {
  return neonAuthClient.signUp.email({
    email: params.email,
    password: params.password,
    name: params.name || params.email.split("@")[0],
    callbackURL: params.callbackURL || "/account",
  });
}

export async function signInWithEmail(params: {
  email: string;
  password: string;
  callbackURL?: string;
}) {
  return neonAuthClient.signIn.email({
    email: params.email,
    password: params.password,
    callbackURL: params.callbackURL || "/account",
  });
}

export async function getCurrentNeonSession() {
  return neonAuthClient.getSession();
}
