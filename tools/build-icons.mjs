/**
 * build-icons.mjs — mengubah ikon SVG Bootstrap Icons pilih-an menjadi satu file
 * JS lokal (assets/js/icons.js) supaya template bisa dipakai 100% offline
 * (tidak ada <img src> eksternal maupun web font ikon).
 *
 * Jalankan:  npm run icons
 */
import fs from "node:fs";
import path from "node:path";

const SRC = "node_modules/bootstrap-icons/icons";
const OUT = "assets/js/icons.js";

/** Ikon yang dipakai template. Tambahkan nama lain sesuai kebutuhan. */
const NAMES = `
speedometer2 grid-1x2 grid-3x3-gap kanban graph-up graph-up-arrow graph-down-arrow bar-chart-line
bar-chart-fill pie-chart diagram-2 diagram-3 activity table card-checklist
file-earmark-text file-earmark-pdf file-earmark-spreadsheet file-earmark-zip file-earmark-code file-earmark-arrow-down
folder folder2-open folder-symlink envelope envelope-fill envelope-paper inbox send send-fill send-check
bell bell-fill paperclip chat-dots chat-dots-fill chat-left-text chat-left-dots chat-square-text reply
reply-all person person-circle person-gear people people-fill person-plus person-plus-fill person-check
person-dash person-badge person-lines-fill gear gear-wide-connected tools wrench sliders sliders2 plus-square
box-arrow-right box-arrow-in-left box-arrow-down-right box-arrow-up-right house house-door search
list list-ul list-ol columns-gap layout-three-columns layout-text-sidebar layout-sidebar-inset
lock lock-fill unlock shield-lock shield-check shield-shaded key key-fill fingerprint
cart cart-check bag basket bag-plus handbag currency-dollar cash cash-coin cash-stack wallet2
credit-card credit-card-2-front receipt receipt percent tags tags-fill qr-code gem
arrow-up arrow-down arrow-left arrow-right arrow-up-short arrow-down-short arrow-down-up arrow-return-left
arrow-left-right arrow-down-left arrow-up-right house-door-fill
play-circle calendar-plus calendar-check bell-fill gift send check2-all
pause-circle hourglass-split hdd-stack file-earmark-pdf file-earmark-text list
arrow-repeat arrow-clockwise arrow-counterclockwise chevron-down chevron-right chevron-left chevron-up
caret-up-fill caret-down-fill x-lg x-circle x-circle-fill check check2 check2-circle check-circle-fill
check-lg plus plus-lg plus-circle dash three-dots three-dots-vertical
exclamation-triangle-fill exclamation-circle exclamation-diamond-fill info-circle info-circle-fill
question-circle question-lg star star-fill star-half bookmark bookmark-star
clock clock-history calendar3 calendar-check calendar3 calendar2-week sun sun-fill moon moon-stars moon-stars-fill
brightness-high brightness-high palette palette2 droplet droplet brush image images camera-video film music-note
cloud-upload cloud-download cloud-check wifi wifi-off power battery-full
bullseye compass rocket trophy building building-gear bank briefcase laptop display phone
keyboard mouse window-sidebar server hdd-stack hdd-rack cpu cpu-fill database stack layers layers-fill
translate globe2 flag flag-fill filter filter-circle funnel sort-down sort-alpha-down
pencil pencil-square trash trash2 eye eye-slash download upload printer copy clipboard clipboard-check clipboard-data
journal-text journal-check journal-arrow-down journal-bookmark-fill hash at type-h1 type-bold type-italic
type-underline justify link link-45deg signpost-split box-seam box-seam-fill truck truck-front map geo-alt
geo-alt-fill pin-angle-fill telephone telephone-fill globe thermometer-half thermometer-half hourglass-split
headset mortarboard compass-fill bicycle bank2 shop shop shop-window cart-plus bag-check box2 boxes
record-circle-fill square square-fill stopwatch fingerprint usb-plug ethernet router hdd-network
sunrise sunset cloud-sun water wind snow2 lightning lightning-charge shield-exclamation shield-x
emoji-smile emoji-smile robot eyeglasses arrows-fullscreen fullscreen fullscreen-exit aspect-ratio
arrows-move arrows-angle-expand arrows-angle-expand arrows-angle-contract crosshair bounding-box-circles
egg cup-hot basket2 gift trophy patch-check-fill patch-check-fill check-circle-fill rocket-takeoff
menu-button-wide menu-button grid list-check book code-slash github linkedin instagram facebook
archive grip-vertical box-arrow-in-right bug
twitter-x youtube whatsapp telegram google slack fire stars zoom-in border-all border-width
person-vcard diagram-3 chat-right-text bank buildings check2-all x-octagon-fill journal-richtext
filetype-pdf toggle-on toggle-off signpost-2 aspect-ratio cloud-arrow-down
`;

const files = fs.existsSync(SRC) ? fs.readdirSync(SRC) : [];
if (!files.length) {
  console.error("✖ Folder node_modules/bootstrap-icons tidak ditemukan. Jalankan: npm install");
  process.exit(1);
}

const wanted = [...new Set(NAMES.split(/\s+/).filter(Boolean))];
const icons = {};
const missing = [];
for (const name of wanted) {
  const file = path.join(SRC, name + ".svg");
  if (!fs.existsSync(file)) { missing.push(name); continue; }
  const svg = fs.readFileSync(file, "utf8");
  icons[name] = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>[\s\S]*$/, "")
    .replace(/\s*\n\s*/g, "")
    .trim();
}

const banner =
  "/*! icons.js — Bootstrap Icons (MIT, https://icons.getbootstrap.com) dibundel lokal.\n" +
  " *  Jangan diubah manual: jalankan `npm run icons` untuk regenerasi. */\n" +
  '/*  Pakai sebagai: <i data-icon="house" data-size="18"></i> */\n';

fs.writeFileSync(
  OUT,
  banner + "window.ICONS = " + JSON.stringify(icons, null, 0).replace(/},{/g, "},\n{") + ";\n"
);
console.log(`✔ ${Object.keys(icons).length} ikon ditulis ke ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
if (missing.length) console.warn("⚠ tidak ditemukan:", missing.join(" "));
