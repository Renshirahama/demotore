import crypto from "node:crypto";

export function createOneTimeToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function hashLineLinkToken(token: string) {
  const pepper = process.env.LINE_LINK_TOKEN_PEPPER ?? "";
  return crypto.createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}
