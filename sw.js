/* Mon patrimoine : fonctionnement hors ligne.
   Ce fichier ne met en cache que le code de l'application.
   Vos données restent dans le stockage du téléphone et ne passent jamais par ici. */
const CACHE = "mon-patrimoine-v1";
const FICHIERS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

/* Réponse immédiate depuis le cache, mise à jour discrète en arrière-plan :
   une nouvelle version déposée en ligne s'affiche au lancement suivant. */
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  const cle = req.mode === "navigate" ? "./index.html" : req;
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const enCache = await cache.match(cle, { ignoreSearch: true });
      const reseau = fetch(req)
        .then(rep => { if (rep && rep.ok) cache.put(cle, rep.clone()); return rep; })
        .catch(() => null);
      if (enCache) { event.waitUntil(reseau); return enCache; }
      const rep = await reseau;
      return rep || new Response("Hors connexion", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    })
  );
});
