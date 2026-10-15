import type { NextConfig } from "next";
// The commons is self-contained. Never proxy public traffic into the legacy operator API.
const nextConfig: NextConfig = { reactStrictMode: true };
export default nextConfig;
