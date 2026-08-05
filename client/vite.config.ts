import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
import { loadEnv } from "vite";

const env = {
	...process.env,
	...loadEnv(process.env.NODE_ENV || "development", process.cwd(), ""),
};

const rawApiUrl = env.VITE_API_URL || env.BACKEND_URL || "";

const getProxyTarget = (url: string) => {
	let cleaned = url.trim().replace(/\/+$/, "");

	// If the user specified a URL that ends with /v1, strip it so the /api/** match works correctly
	if (cleaned.endsWith("/v1")) {
		cleaned = cleaned.substring(0, cleaned.length - 3);
	}

	// Ensure it ends with /api (without trailing slash)
	if (!cleaned.endsWith("/api")) {
		cleaned = cleaned + "/api";
	}

	return cleaned + "/**";
};

const proxyTarget = rawApiUrl ? getProxyTarget(rawApiUrl) : "";
if (proxyTarget) {
	console.log("Setting Nitro proxy target to:", proxyTarget);
}

const routeRules: Record<string, any> = {};
if (proxyTarget && !rawApiUrl.includes("localhost") && !rawApiUrl.includes("127.0.0.1")) {
	routeRules["/api/**"] = {
		proxy: proxyTarget,
	};
}

export default defineConfig({
	cloudflare: false,
	plugins: [
		nitro({
			preset: "vercel",
			routeRules,
		}),
	],
	vite: {
		server: {
			// Local dev proxy — only used during `npm run dev`
			proxy: rawApiUrl
				? {
					'/api': {
						target: rawApiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, ''),
						changeOrigin: true,
						secure: false,
					},
				}
				: undefined,
		},
	},
});

