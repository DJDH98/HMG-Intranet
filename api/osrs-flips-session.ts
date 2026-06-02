import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_HOST = process.env.FLIPPING_COPILOT_HOST || "https://api.flippingcopilot.com";
const COOKIE_NAME = "hmg_fc_jwt";
const USER_ID_COOKIE_NAME = "hmg_fc_user_id";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function cookieOptions(maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function readJsonBody(req: VercelRequest) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);
  return {};
}

async function loginToFlippingCopilot(email: string, password: string) {
  const token = Buffer.from(`${email}:${password}`).toString("base64");
  const response = await fetch(`${API_HOST}/login`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json"
    },
    body: ""
  });
  const body = await response.text();

  if (!response.ok) {
    let message = "Flipping Copilot login failed.";
    try {
      message = JSON.parse(body).message || message;
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }

  return body ? JSON.parse(body) : {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", [
      `${COOKIE_NAME}=; ${cookieOptions(0)}`,
      `${USER_ID_COOKIE_NAME}=; ${cookieOptions(0)}`
    ]);
    return res.json({ success: true });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, DELETE");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { email, password } = await readJsonBody(req);
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required." });
    }

    const login = await loginToFlippingCopilot(email.trim(), password);
    if (!login.jwt) {
      return res.status(502).json({ success: false, error: "Flipping Copilot did not return a login token." });
    }

    res.setHeader("Set-Cookie", [
      `${COOKIE_NAME}=${encodeURIComponent(login.jwt)}; ${cookieOptions(MAX_AGE_SECONDS)}`,
      `${USER_ID_COOKIE_NAME}=${encodeURIComponent(String(login.user_id || ""))}; ${cookieOptions(MAX_AGE_SECONDS)}`
    ]);
    return res.json({ success: true, userId: login.user_id || null });
  } catch (error: any) {
    return res.status(401).json({ success: false, error: error.message || "Flipping Copilot login failed." });
  }
}
