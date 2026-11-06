/* ---------- daily report stylesheet (screen preview and PDF share it) ---------- */
const RPT_CSS = `
.rpt{--r-ink:#1C1B18;--r-ink2:#4A463F;--r-mut:#7C766C;--r-line:#E6E0D4;--r-line2:#F0ECE3;--r-gold:#B8893A;--r-gold-d:#86641C;--r-soft:#FBF6EA;
  font:400 10.5px/1.45 "IBM Plex Sans","Segoe UI",Arial,sans-serif;color:var(--r-ink);background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rpt *{box-sizing:border-box}
.rpt .r-head{display:flex;gap:22px;align-items:center;padding-bottom:14px;border-bottom:2px solid var(--r-gold);margin-bottom:14px}
.rpt .r-logo{width:118px;height:auto;flex:none}
.rpt .r-title{flex:1;min-width:0}
.rpt .r-eyebrow{font-size:9px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--r-gold-d)}
.rpt h1{margin:3px 0 4px;font:600 21px/1.15 "IBM Plex Sans","Segoe UI",Arial,sans-serif;letter-spacing:-.01em}
.rpt .r-title p{margin:0;color:var(--r-ink2);font-size:10px}
.rpt .r-title p.r-gen{color:var(--r-mut);font-size:9px;margin-top:2px}
.rpt .r-kpis{display:grid;grid-template-columns:repeat(6,1fr);border:1px solid var(--r-line);border-radius:6px;overflow:hidden;margin-bottom:16px}
.rpt .r-k{padding:8px 10px 9px;border-right:1px solid var(--r-line2);background:var(--r-soft)}
.rpt .r-k:last-child{border-right:0}
.rpt .r-k span{display:block;font-size:8px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--r-mut)}
.rpt .r-k b{display:block;font:600 14px/1.25 "IBM Plex Sans","Segoe UI",Arial,sans-serif;margin-top:3px;font-variant-numeric:tabular-nums;white-space:nowrap}
.rpt .r-k small{display:block;font-size:8.5px;color:var(--r-mut);margin-top:1px}
.rpt .r-sec{margin:0 0 15px;break-inside:auto}
.rpt .r-sec h2{display:flex;align-items:baseline;gap:8px;margin:0 0 7px;padding-bottom:4px;border-bottom:1px solid var(--r-line);font:600 12.5px/1.2 "IBM Plex Sans","Segoe UI",Arial,sans-serif;break-after:avoid}
.rpt .r-sec h2 span{font:500 9px "IBM Plex Mono",Consolas,monospace;color:var(--r-gold-d)}
.rpt .r-sec h2 small{margin-left:auto;font:400 9.5px "IBM Plex Sans","Segoe UI",Arial,sans-serif;color:var(--r-mut)}
.rpt h3{margin:10px 0 5px;font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--r-ink2);break-after:avoid}
.rpt .r-t{width:100%;border-collapse:collapse;font-size:9.5px}
.rpt .r-t th{text-align:left;font-size:7.8px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--r-mut);padding:5px 6px;border-bottom:1px solid var(--r-line);background:#FAF8F3}
.rpt .r-t td{padding:5px 6px;border-bottom:1px solid var(--r-line2);vertical-align:top}
.rpt .r-t tr{break-inside:avoid}
.rpt .r-t .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.rpt .r-t td small{color:var(--r-mut);font-size:8.5px}
.rpt .r-t tfoot td{font-weight:600;border-top:1px solid var(--r-line);border-bottom:0}
.rpt .r-t td.wrap{white-space:normal}
.rpt .mono{font-family:"IBM Plex Mono",Consolas,monospace;font-size:8.8px}
.rpt .neg{color:#B8381F}
.rpt .r-none{margin:0;color:var(--r-mut);font-style:italic;font-size:9.5px}
.rpt .r-more{margin:4px 0 0;color:var(--r-mut);font-size:9px}
.rpt .r-line{margin:8px 0 0;font-size:9.5px}
.rpt .r-off{color:#DDD6C8}
.rpt .r-pill{display:inline-block;padding:1px 6px;border-radius:9px;font-size:8.5px;font-weight:600;white-space:nowrap}
.rpt .r-pill.t-good{background:#E3F2E8;color:#1D7A47}.rpt .r-pill.t-warn{background:#FBF1DB;color:#986109}.rpt .r-pill.t-bad{background:#FBE5DE;color:#B8381F}
.rpt .r-pill.t-info{background:#E6EDF8;color:#2C5C9E}.rpt .r-pill.t-acc{background:#F7F0DE;color:#86641C}.rpt .r-pill.t-neu{background:#F1EEE7;color:#4A463F}
.rpt .r-upds{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.rpt .r-upd{border:1px solid var(--r-line);border-left:3px solid var(--r-gold);border-radius:4px;padding:6px 9px;break-inside:avoid;background:#fff}
.rpt .r-upd-h{display:flex;gap:6px;align-items:baseline;font-size:9.5px}
.rpt .r-upd-h .r-tag{font-size:8px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--r-gold-d)}
.rpt .r-upd-h .r-time{margin-left:auto;color:var(--r-mut);font-size:8.5px}
.rpt .r-upd p{margin:3px 0 0;white-space:pre-wrap;font-size:9.5px;color:var(--r-ink2)}
.rpt .r-foot{margin-top:18px;padding-top:8px;border-top:1px solid var(--r-line);font-size:8.5px;color:var(--r-mut)}
`;
document.head.insertAdjacentHTML('beforeend', '<style id="rptcss">' + RPT_CSS + '</style>');
