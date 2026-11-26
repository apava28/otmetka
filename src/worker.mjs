import { handleApi } from "../core/api.mjs";
import { authPage } from "../public/views.mjs";

function homePage() {
  return `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Отметка — журнал посещений</title><link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/journal.css"></head>
<body><div id="app">${authPage()}</div><script type="module" src="/journal.js"></script></body></html>`;
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) return handleApi(request, env.DB);
    if (pathname === "/" && ["GET", "HEAD"].includes(request.method)) {
      return new Response(request.method === "HEAD" ? null : homePage(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
