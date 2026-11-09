import { createAuthClient } from "@neon/auth";

async function main() {
  const authBaseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!authBaseUrl) {
    throw new Error("NEON_AUTH_BASE_URL is missing in environment");
  }

  const authClient = createAuthClient(authBaseUrl);

  const testEmail = `neon-test-${Date.now()}@zaptut.pro`;
  const testPassword = `TestSecure2026!P@ss`;
  const testName = "Neon Staging User";

  console.log("=== TESTING NEON MANAGED BETTER AUTH ===");
  console.log(`1. Attempting sign up for test user: ${testEmail}...`);

  const signUpResult = await authClient.signUp.email({
    email: testEmail,
    password: testPassword,
    name: testName,
    callbackURL: "https://zaptut-staging.netlify.app",
    fetchOptions: {
      headers: {
        Origin: "https://zaptut-staging.netlify.app",
      },
    },
  });

  if (signUpResult.error) {
    console.error("Sign up failed:", signUpResult.error);
    process.exit(1);
  }

  console.log("  ✓ Sign up successful!");
  console.log("  User ID:", signUpResult.data?.user?.id);
  console.log("  User Email:", signUpResult.data?.user?.email);
  console.log("  User Name:", signUpResult.data?.user?.name);

  // 2. Read back current session / user
  console.log("2. Reading current user back...");
  const sessionResult = await authClient.getSession({
    fetchOptions: {
      headers: signUpResult.data?.token ? {
        Authorization: `Bearer ${signUpResult.data.token}`,
      } : {},
    },
  });

  if (sessionResult.data?.user) {
    console.log("  ✓ Session verified!");
    console.log("  Verified User ID:", sessionResult.data.user.id);
    console.log("  Verified User Email:", sessionResult.data.user.email);
  } else {
    // If cookie was returned in headers, sign in directly with email & password to verify credentials
    console.log("2b. Verifying via signIn.email...");
    const signInResult = await authClient.signIn.email({
      email: testEmail,
      password: testPassword,
      callbackURL: "https://zaptut-staging.netlify.app",
      fetchOptions: {
        headers: {
          Origin: "https://zaptut-staging.netlify.app",
        },
      },
    });

    if (signInResult.error) {
      console.error("Sign in failed:", signInResult.error);
      process.exit(1);
    }

    console.log("  ✓ Sign in successful!");
    console.log("  Signed-in User ID:", signInResult.data?.user?.id);
    console.log("  Signed-in User Email:", signInResult.data?.user?.email);
    console.log("  Signed-in User Name:", signInResult.data?.user?.name);
  }

  console.log("=== NEON MANAGED AUTH PROVEN WORKING SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
