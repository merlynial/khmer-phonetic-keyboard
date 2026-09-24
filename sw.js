// Offline cache for the keyboard.
//
// The app itself (the pages, dict.js) is network-first, so edits show
// immediately when online, but the app still loads with no connection.
//
// The big files that rarely change (the lexicon, the bigrams, the font, the
// icons) come straight from the cache and are refreshed in the background for
// next time. Fetching them first made every launch wait on ~3 MB of network.
const CACHE = "khmer-kbd-0.14.1";
const ASSETS = ["./", "./index.html", "./install.html", "./dict.js", "./words.txt",
                "./bigrams.txt", "./fonts/Siemreap-Regular.ttf", "./icons/icon-192.png",
                "./manifest.webmanifest"];
const STATIC = /\/(words\.txt|bigrams\.txt|fonts\/[^/]+|icons\/[^/]+)$/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "no-cache" }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

// Keep a good response for offline use. An error page must never replace a
// working copy, and an unchanged file is not written again.
async function keep(req, res) {
  if (!res.ok) return;
  const cache = await caches.open(CACHE);
  const tag = r => r && (r.headers.get("etag") || r.headers.get("last-modified"));
  if (tag(res) && tag(res) === tag(await cache.match(req))) return;
  await cache.put(req, res);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Downloads (the APK, the Keyman packages) are not part of the app: leave
  // them to the browser instead of copying megabytes into the offline cache.
  if (url.origin !== location.origin || url.pathname.includes("/dist/")) return;

  // no-cache: revalidate with the server instead of trusting the HTTP cache,
  // so a new deploy is picked up on the next reload
  const fresh = fetch(req, { cache: "no-cache" }).then(res => {
    e.waitUntil(keep(req, res.clone()).catch(() => {}));
    return res;
  });
  const offline = () => caches.match(req).then(r => r || caches.match("./index.html"));

  if (!STATIC.test(url.pathname)) {
    e.respondWith(fresh.catch(offline));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    if (!hit) return fresh.catch(offline);
    e.waitUntil(fresh.catch(() => {}));
    return hit;
  }));
});
