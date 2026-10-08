/** Keep old auth callbacks and machine endpoints reachable during migration. */
export function domainRedirect(input: string, method: string): string | null {
 const url = new URL(input);
 if (!["GET", "HEAD"].includes(method)) return null;
 if (!["ezmerch.store", "www.ezmerch.store", "verymerch.com"].includes(url.hostname)) return null;
 if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") ||
     url.searchParams.has("code") || url.searchParams.has("token_hash") ||
     url.pathname === "/update-password") return null;
 url.hostname = "www.verymerch.com";
 url.protocol = "https:";
 url.port = "";
 return url.href;
}
