/* Mon patrimoine : fonctionnement hors ligne.
   Ce fichier ne met en cache que le code de l'application.
   Vos données restent dans le stockage du téléphone et ne passent jamais par ici. */
const CACHE = "mon-patrimoine-v2";
const PAGE = "./index.html";
const FICHIERS = [
  PAGE,
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];
const DELAI_RESEAU = 3000;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FICHIERS.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  /* La page : version en ligne en priorité, pour qu'une mise à jour s'affiche dès la réouverture.
     Sans réseau, ou s'il tarde plus de 3 secondes, la copie enregistrée prend le relais. */
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const reseau = fetch(req).then(rep => {
        if (rep && rep.ok && rep.type === "basic") cache.put(PAGE, rep.clone());
        return rep;
      });
      event.waitUntil(reseau.catch(() => {}));
      try {
        const rep = await Promise.race([
          reseau,
          new Promise((_, rejet) => setTimeout(() => rejet(new Error("délai")), DELAI_RESEAU))
        ]);
        if (rep && (rep.ok || rep.type === "opaqueredirect")) return rep;
      } catch (e) {}
      const copie = await cache.match(PAGE);
      return copie || reseau.catch(() => new Response("Hors connexion", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
    })());
    return;
  }

  /* Icônes et manifeste : copie enregistrée, rafraîchie discrètement en arrière-plan. */
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const copie = await cache.match(req, { ignoreSearch: true });
    const reseau = fetch(req).then(rep => { if (rep && rep.ok) cache.put(req, rep.clone()); return rep; }).catch(() => null);
    if (copie) { event.waitUntil(reseau); return copie; }
    return (await reseau) || new Response("", { status: 503 });
  })());
});
