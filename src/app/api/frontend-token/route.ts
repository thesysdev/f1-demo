import { hasAllowedOrigin } from "../../../lib/same-origin";
import { readUserId } from "../../../lib/user-id";

export const runtime = "nodejs";

// Mints the short-lived frontend token that useOpenuiCloudStorage() sends with its
// Conversations API calls. Gateway scopes the token to the visitor's anonymous id and this app,
// so each browser reaches only its own threads and never sees THESYS_API_KEY.
export async function POST(request: Request) {
  if (!hasAllowedOrigin(request))
    return Response.json(
      { error: "This example only accepts requests from its local chat interface." },
      { status: 403 },
    );
  const userId = readUserId(request);
  if (!userId) return Response.json({ error: "Missing visitor id." }, { status: 401 });
  const apiKey = process.env.THESYS_API_KEY;
  if (!apiKey) throw new Error("Set THESYS_API_KEY in .env.local, then restart.");

  const upstream = await fetch("https://api.thesys.dev/v1/frontend-tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      // No sign-in: the browser's anonymous id (lib/user-id.ts) keeps visitors' threads apart.
      // Use the signed-in user's id instead when you add authentication:
      // https://www.openui.com/docs/gateway/authentication
      user_id: userId,
      // Keeps this example's threads apart from other apps that use the same key.
      app_id: process.env.APP_ID || "f1-dashboard",
    }),
    signal: request.signal,
  });
  if (!upstream.ok)
    return Response.json(
      { error: "OpenUI Gateway could not create a frontend token." },
      { status: upstream.status },
    );
  const { token, expires_at } = (await upstream.json()) as { token: string; expires_at: number };
  return Response.json(
    { token, expires_at },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
