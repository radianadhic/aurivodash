/*! ---------------------------------------------------------------------------
 *  minigrid/export.js — ekspor XLSX & PDF asli tanpa library (menempel ke
 *  MiniGrid.prototype; muat SETELAH grid.js).
 *  Sumber : https://github.com/radianadhic/minigrid  (file src/export.js)
 *  Versi  : commit 5703470 (19 Sep 2026); lisensi MIT dari commit 7c4b69ea
 *           (20 Sep 2026) — lihat assets/js/minigrid/LICENSE. Di-vendor apa adanya.
 * ------------------------------------------------------------------------- */
/* ============================================================================
 * export.js — pengekspor XLSX & PDF asli tanpa dependency
 *  · XLSX: OOXML minimal dibungkus ZIP (store, CRC32 sendiri) — header tebal
 *    berwarna, pane beku, AutoFilter, lebar kolom, format angka #,##0
 *  · PDF : PDF 1.4 Helvetica — lanskap otomatis bila lebar, angka rata kanan,
 *    strip zebra, nomor halaman; nama berkas ber-tanggal
 * ============================================================================ */
(function (global) {
  'use strict';
  var P = global.MiniGrid.prototype;

  var XESC = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  /* ------------------------------------------------------------ CRC32 + ZIP */
  var CT = (function () {
    var t = [], c, n, k;
    for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) {
    var c = 0xFFFFFFFF, i;
    for (i = 0; i < b.length; i++) c = CT[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zipStore(files) {
    var enc = new TextEncoder(), body = [], cent = [], off = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true);
      body.push(new Uint8Array(lh.buffer), name, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      cent.push([new Uint8Array(ch.buffer), name]);
      off += 30 + name.length + data.length;
    });
    var cd = 0;
    cent.forEach(function (c) { cd += c[0].length + c[1].length; });
    var eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054b50, true);
    eo.setUint16(8, files.length, true); eo.setUint16(10, files.length, true);
    eo.setUint32(12, cd, true); eo.setUint32(16, off, true);
    var all = body.concat.apply(body, cent);
    all.push(new Uint8Array(eo.buffer));
    var total = 0; all.forEach(function (a) { total += a.length; });
    var out = new Uint8Array(total), p = 0;
    all.forEach(function (a) { out.set(a, p); p += a.length; });
    return out;
  }

  function colRef(i) {
    var s = ''; i++;
    while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - 1 - m) / 26; }
    return s;
  }
  function dl(bytes, name, type) {
    var b = new Blob([bytes], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function stamp() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* ------------------------------------------------------------------ CSV */
  P.toCSV = function () {
    var cols = this.vis();
    var lines = [cols.map(function (c) { return '"' + c.label + '"'; }).join(',')];
    this.view.forEach(function (r) {
      lines.push(cols.map(function (c) { return '"' + String(r[c.name] == null ? '' : r[c.name]).replace(/"/g, '""') + '"'; }).join(','));
    });
    dl(new TextEncoder().encode('\ufeff' + lines.join('\r\n')), 'minigrid-' + stamp() + '.csv', 'text/csv;charset=utf-8');
  };

  /* ----------------------------------------------------------------- XLSX */
  P.toXLSX = function () {
    var cols = this.vis(), rows = this.view.slice(0, 20000);
    var x = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>',
      '<cols>' + cols.map(function (c, i) {
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + Math.max(9, Math.round(c.width / 7)) + '" customWidth="1"/>';
      }).join('') + '</cols>',
      '<sheetData>'];
    x.push('<row r="1" ht="18" customHeight="1">' + cols.map(function (c, i) {
      return '<c r="' + colRef(i) + '1" s="1" t="inlineStr"><is><t>' + XESC(c.label) + '</t></is></c>';
    }).join('') + '</row>');
    rows.forEach(function (r, ri) {
      x.push('<row r="' + (ri + 2) + '">' + cols.map(function (c, i) {
        var v = r[c.name], ref = colRef(i) + (ri + 2);
        if (c.bool) return '<c r="' + ref + '" t="inlineStr"><is><t>' + (v ? 'Ya' : 'Tidak') + '</t></is></c>';
        if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '" s="' + (v % 1 ? 3 : 2) + '"><v>' + v + '</v></c>';
        if (c.type === 'num' && v !== null && v !== '' && isFinite(Number(v))) {
          var n = Number(v); return '<c r="' + ref + '" s="' + (n % 1 ? 3 : 2) + '"><v>' + n + '</v></c>';
        }
        return '<c r="' + ref + '" t="inlineStr"><is><t>' + XESC(v == null ? '' : v) + '</t></is></c>';
      }).join('') + '</row>');
    });
    x.push('</sheetData>');
    if (rows.length) x.push('<autoFilter ref="A1:' + colRef(cols.length - 1) + (rows.length + 1) + '"/>');
    x.push('</worksheet>');
    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="#,##0.0"/></numFmts>' +
      '<fonts count="2"><font><sz val="10"/><name val="Calibri"/></font><font><b/><color rgb="FF1F2937"/><sz val="10"/><name val="Calibri"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F1"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><bottom style="thin"><color rgb="FF94A3B8"/></bottom></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="4">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>' +
      '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
    var zip = zipStore([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: styles },
      { name: 'xl/worksheets/sheet1.xml', data: x.join('') }
    ]);
    dl(zip, 'minigrid-' + stamp() + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  /* ------------------------------------------------------------------ PDF */
  P.toPDF = function () {
    var cols = this.vis(), rows = this.view.slice(0, 5000);
    var A = function (s) { return String(s == null ? '' : s).replace(/[^\x20-\x7E]/g, '?'); };
    var E = function (s) { return A(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); };
    var chars = cols.map(function (c) { return Math.max(6, Math.min(26, Math.round(c.width / 7))); });
    var xs = [30];
    chars.forEach(function (ch, i) { xs.push(xs[i] + ch * 4.3); });
    var span = xs[xs.length - 1] - 30;
    var land = span > 535;                                  /* potret muat 535pt */
    var W = land ? 842 : 595, H = land ? 595 : 842;
    var k = span > W - 60 ? (W - 60) / span : 1;            /* skala bila masih lebar */
    var X = function (i) { return 30 + (xs[i] - 30) * k; };
    var CW = function (i) { return chars[i] * 4.3 * k; };
    var right = 30 + span * k;
    var fsB = Math.max(6, 7.5 * k), fsH = Math.max(6.5, 8 * k);
    var titleY = H - 32, lineY = H - 40, headY = H - 56, rowY0 = headY - 19, bottom = 48;
    var perPage = Math.floor((rowY0 - bottom) / 11), pages = [];
    for (var i = 0; i < Math.max(1, rows.length); i += perPage) pages.push(rows.slice(i, i + perPage));
    var tanggal = stamp();

    var objs = [], kids = [], n = 5;
    pages.forEach(function (pg, pi) {
      var s = 'BT /F2 10 Tf 30 ' + titleY + ' Td (' + E('MiniGrid - ' + this.tr('pdfSub', this.view.length)) + ') Tj ET\n';
      s += 'BT /F1 8 Tf ' + (right - tanggal.length * 4.4).toFixed(1) + ' ' + (titleY + 1) + ' Td (' + tanggal + ') Tj ET\n';
      s += '0.7 w 30 ' + lineY + ' m ' + right.toFixed(1) + ' ' + lineY + ' l S\n';
      var y = headY;
      s += 'q 0.92 g 30 ' + (y - 8) + ' ' + (right - 30).toFixed(1) + ' 13 re f Q\n';
      s += 'BT /F2 ' + fsH.toFixed(1) + ' Tf';
      cols.forEach(function (c, ci) {
        var t = A(c.label); if (t.length > chars[ci]) t = t.slice(0, chars[ci] - 1) + '.';
        s += ' 1 0 0 1 ' + X(ci).toFixed(1) + ' ' + y + ' Tm (' + E(t) + ') Tj';
      });
      s += ' ET\n';
      y = rowY0;
      pg.forEach(function (r, ri) {
        if (ri % 2) s += 'q 0.96 g 30 ' + (y - 8) + ' ' + (right - 30).toFixed(1) + ' 11 re f Q\n';
        s += 'BT /F1 ' + fsB.toFixed(1) + ' Tf';
        cols.forEach(function (c, ci) {
          var t = A(r[c.name]);
          if (t.length > chars[ci]) t = t.slice(0, chars[ci] - 1) + '.';
          var x = X(ci);
          if (c.align === 'right') x = X(ci) + CW(ci) - t.length * fsB * 0.56 - 2;
          s += ' 1 0 0 1 ' + x.toFixed(1) + ' ' + y + ' Tm (' + E(t) + ') Tj';
        });
        s += ' ET\n';
        y -= 11;
      });
      var pl = this.tr('page', pi + 1, pages.length);
      s += '0.7 w 30 40 m ' + right.toFixed(1) + ' 40 l S\n';
      s += 'BT /F1 7.5 Tf 30 30 Td (MiniGrid - ' + E(tanggal) + ') Tj ET\n';
      s += 'BT /F1 7.5 Tf ' + (right - pl.length * 4.2).toFixed(1) + ' 30 Td (' + pl + ') Tj ET\n';
      var cid = n + 1;
      kids.push(n + ' 0 R');
      objs.push([n, '<</Type/Page/Parent 2 0 R/MediaBox[0 0 ' + W + ' ' + H + ']/Resources<</Font<</F1 3 0 R/F2 4 0 R>>>>/Contents ' + cid + ' 0 R>>']);
      objs.push([cid, '<</Length ' + s.length + '>>\nstream\n' + s + 'endstream']);
      n += 2;
    }, this);

    var list = [
      [1, '<</Type/Catalog/Pages 2 0 R>>'],
      [2, '<</Type/Pages/Kids[' + kids.join(' ') + ']/Count ' + kids.length + '>>'],
      [3, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'],
      [4, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>']
    ].concat(objs);
    var out = '%PDF-1.4\n', offsets = {};
    list.forEach(function (it) {
      offsets[it[0]] = out.length;
      out += it[0] + ' 0 obj\n' + it[1] + '\nendobj\n';
    });
    var count = list.length;
    var xref = 'xref\n0 ' + (count + 1) + '\n0000000000 65535 f \n';
    for (var q = 1; q <= count; q++) xref += String(offsets[q]).padStart(10, '0') + ' 00000 n \n';
    out += xref + 'trailer\n<</Size ' + (count + 1) + '/Root 1 0 R>>\nstartxref\n' + out.length + '\n%%EOF';
    dl(new TextEncoder().encode(out), 'minigrid-' + stamp() + '.pdf', 'application/pdf');
  };
})(typeof window !== 'undefined' ? window : globalThis);
