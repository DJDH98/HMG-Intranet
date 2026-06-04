import type { ApiRequest, ApiResponse } from "./types.js";

const API_HOST = process.env.FLIPPING_COPILOT_HOST || "https://api.flippingcopilot.com";
const COOKIE_NAME = "hmg_fc_jwt";
const USER_ID_COOKIE_NAME = "hmg_fc_user_id";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const MAX_BODY_BYTES = 4096;
const LOGIN_WINDOW_MS = 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function cookieOptions(maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/api/osrs-flips; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function getRequestIp(req: ApiRequest) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return String(value || "unknown").split(",")[0].trim() || "unknown";
}

function checkLoginRateLimit(req: ApiRequest, email: string) {
  const now = Date.now();
  const key = `${getRequestIp(req)}:${email.toLowerCase()}`;
  const current = loginAttempts.get(key);

  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }

  current.count += 1;
  return current.count <= MAX_LOGIN_ATTEMPTS;
}

async function readJsonBody(req: ApiRequest) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    if (Buffer.byteLength(req.body, "utf8") > MAX_BODY_BYTES) {
      throw new Error("Request body is too large.");
    }
    return JSON.parse(req.body);
  }
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
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
    const trimmedEmail = typeof email === "string" ? email.trim() : "";
    if (typeof email !== "string" || typeof password !== "string" || !trimmedEmail || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required." });
    }
    if (trimmedEmail.length > 254 || password.length > 256) {
      return res.status(400).json({ success: false, error: "Email or password is too long." });
    }
    if (!checkLoginRateLimit(req, trimmedEmail)) {
      return res.status(429).json({ success: false, error: "Too many login attempts. Please wait a minute and try again." });
    }

    const login = await loginToFlippingCopilot(trimmedEmail, password);
    if (!login.jwt) {
      return res.status(502).json({ success: false, error: "Flipping Copilot did not return a login token." });
    }

    res.setHeader("Set-Cookie", [
      `${COOKIE_NAME}=${encodeURIComponent(login.jwt)}; ${cookieOptions(MAX_AGE_SECONDS)}`,
      `${USER_ID_COOKIE_NAME}=${encodeURIComponent(String(login.user_id || ""))}; ${cookieOptions(MAX_AGE_SECONDS)}`
    ]);
    return res.json({ success: true, userId: login.user_id || null });
  } catch (error: any) {
    const message = error?.message === "Request body is too large."
      ? error.message
      : "Flipping Copilot login failed. Please check your details and try again.";
    return res.status(error?.message === "Request body is too large." ? 413 : 401).json({ success: false, error: message });
  }
}
