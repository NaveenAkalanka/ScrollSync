// Fills every [data-version] from the manifest, so the version is set in one place (manifest.json).
(() => {
  const v = globalThis.chrome?.runtime?.getManifest?.().version;
  if (!v) return;
  document.querySelectorAll('[data-version]').forEach((el) => {
    el.textContent = (el.dataset.version || '') + v;
  });
})();
