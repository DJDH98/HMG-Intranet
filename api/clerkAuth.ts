import { verifyToken } from "@clerk/backend";

export async function requireAuthenticatedRequest(req: any, res: any) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!secretKey || !publishableKey) {
    res.status(503).json({ success: false, error: "Authentication is not configured." });
    return false;
  }

  const authorization = req.headers.authorization || req.headers.Authorization || "";
  const token = typeof authorization === "string" && authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return false;
  }

  try {
    await verifyToken(token, { secretKey });
    return true;
  } catch (error) {
    console.error("Clerk token verification failed:", error);
  }

  if (!res.headersSent) {
    res.status(401).json({ success: false, error: "Unauthorized" });
  }
  return false;
}
