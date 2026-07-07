// Offline cache for the keyboard. Network-first so edits show immediately
// when online, but the app still loads with no connection.
const CACHE = "khmer-kbd-0.8";
const ASSETS = ["./", "./index.html", "./dict.js", "./words.txt", "./bigrams.txt",
                "./fonts/Siemreap-Regular.ttf", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    // no-cache: revalidate with the server instead of trusting the HTTP cache,
    // so a new deploy is picked up on the next reload
    fetch(e.request, { cache: "no-cache" })
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
