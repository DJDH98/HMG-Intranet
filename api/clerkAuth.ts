import { createClerkClient } from "@clerk/backend";

export async function requireAuthenticatedRequest(req: any, res: any) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!secretKey || !publishableKey) {
    res.status(503).json({ success: false, error: "Authentication is not configured." });
    return false;
  }

  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const requestUrl = `${protocol}://${host}${req.url || "/"}`;
  const requestHeaders = new Headers();

  for (const [key, value] of Object.entries(req.headers || {})) {
    if (Array.isArray(value)) {
      requestHeaders.set(key, value.join(", "));
    } else if (typeof value === "string") {
      requestHeaders.set(key, value);
    }
  }

  const clerkClient = createClerkClient({ secretKey, publishableKey });
  const requestState = await clerkClient.authenticateRequest(
    new Request(requestUrl, { headers: requestHeaders })
  );

  if (!requestState.isAuthenticated) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return false;
  }

  return true;
}
