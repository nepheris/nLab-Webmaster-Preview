/* nLab SCR10 — Web Auto Translate Bar
 * Experimental integration helper for Google Translate's legacy client element.
 * No API key is embedded. Use only after validating provider availability/policy for the target site.
 */
(function (global) {
  "use strict";
  const DEFAULTS = {
    sourceLanguage: "fr",
    languages: ["en", "es", "de", "it", "nl", "pt"],
    mountId: "nlab-auto-translate",
    notice: "Traduction automatique",
    providerScript: "https://translate.google.com/translate_a/element.js?cb=nLabGoogleTranslateInit"
  };
  function normalizeLanguages(languages) {
    return [...new Set((languages || []).map(String).map(v => v.trim().toLowerCase()).filter(Boolean))];
  }
  function ensureMount(config) {
    let root = document.getElementById(config.mountId);
    if (!root) { root = document.createElement("div"); root.id = config.mountId; document.body.prepend(root); }
    root.setAttribute("data-nlab-component", "auto-translate-bar");
    root.innerHTML = "";
    const widget = document.createElement("div"); widget.id = config.mountId + "-provider"; root.appendChild(widget);
    const notice = document.createElement("small"); notice.className = "nlab-translate-notice"; notice.textContent = config.notice; root.appendChild(notice);
    return widget.id;
  }
  function loadScript(src) {
    if (document.querySelector('script[data-nlab-translate-provider="google"]')) return;
    const script = document.createElement("script"); script.src = src; script.async = true; script.dataset.nlabTranslateProvider = "google"; document.head.appendChild(script);
  }
  function mount(options) {
    const config = Object.assign({}, DEFAULTS, options || {});
    config.languages = normalizeLanguages(config.languages);
    const providerMountId = ensureMount(config);
    global.nLabGoogleTranslateInit = function () {
      if (!global.google || !global.google.translate || !global.google.translate.TranslateElement) {
        console.warn("[SCR10] Translation provider unavailable; French source remains usable."); return;
      }
      new global.google.translate.TranslateElement({
        pageLanguage: config.sourceLanguage, includedLanguages: config.languages.join(","), autoDisplay: false,
        layout: global.google.translate.TranslateElement.InlineLayout.SIMPLE
      }, providerMountId);
    };
    loadScript(config.providerScript);
    return { mountId: config.mountId, languages: config.languages.slice(), sourceLanguage: config.sourceLanguage };
  }
  global.nLabAutoTranslateBar = { mount, normalizeLanguages, defaults: Object.freeze(Object.assign({}, DEFAULTS)) };
})(window);
