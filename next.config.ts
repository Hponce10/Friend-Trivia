import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force Firestore's browser (WebChannel) build into the server bundle.
  // The default Node build pulls in gRPC + protobufjs, whose dynamic code
  // generation is forbidden on the Cloudflare Workers runtime. The relative
  // file path bypasses the package's exports map (dist/* isn't exported).
  turbopack: {
    resolveAlias: {
      "@firebase/firestore": "./node_modules/@firebase/firestore/dist/index.esm.js",
    },
  },
};

export default nextConfig;
