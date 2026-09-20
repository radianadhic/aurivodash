/*
 * theme-boot.js — dijalankan SINKRON di <head> sebelum CSS dirender,
 * supaya tidak ada "kedipan" warna saat halaman dimuat (FOUC).
 * Membaca preferensi tema & skin yang tersimpan di localStorage.
 */
(function () {
  var t = "light", s = "blue", sb = "dark", lg = "id";
  try {
    t = localStorage.getItem("app.theme") || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    s = localStorage.getItem("app.skin") || "blue";
    sb = localStorage.getItem("app.sidebar") || "dark";   // dark | light
    lg = localStorage.getItem("app.locale") || "id";      // id | en
  } catch (e) { /* mode privat / file:// tanpa storage */ }
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.setAttribute("data-skin", s);
  document.documentElement.setAttribute("data-sidebar", sb);
  document.documentElement.setAttribute("lang", lg);
})();
