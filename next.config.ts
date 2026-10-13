import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/base-path";

const config: NextConfig = {
  basePath: BASE_PATH,
  turbopack: { root: process.cwd() },
  // Ship the OpenF1 snapshot (gitignored) with the server functions when deployed.
  outputFileTracingIncludes: { "/api/**": ["./data/**"] },
  async redirects() {
    // The deployment's own domain still opens the demo.
    return [{ source: "/", destination: BASE_PATH, basePath: false, permanent: false }];
  },
};

export default config;
