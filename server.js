/*
  VrijMignotBo: tiny server with a JSON file as database. No dependencies, Node 18+.

  Start:   ADMIN_TOKEN=kies-een-geheim DATA_DIR=./data node server.js
  Guests:  https://jouw-adres/admin?token=kies-een-geheim   (list)
           https://jouw-adres/api/guests?token=...         (raw json)
  Data:    DATA_DIR/guests.json  (put DATA_DIR on a persistent disk, or it is lost on redeploy)
  Env:     PORT (3000), DATA_DIR (./data), ADMIN_TOKEN, ALLOWED_ORIGIN (only if the page is hosted elsewhere)
*/
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB = path.join(DATA_DIR, "guests.json");
const ORIGIN = process.env.ALLOWED_ORIGIN || "";
let TOKEN = process.env.ADMIN_TOKEN;
if (!TOKEN) { TOKEN = crypto.randomBytes(9).toString("hex"); console.log("ADMIN_TOKEN not set, temporary token:", TOKEN); }

fs.mkdirSync(DATA_DIR, { recursive: true });
let guests = [];
try { guests = JSON.parse(fs.readFileSync(DB, "utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; }

/* one write at a time; write to a temp file, then rename, so the file is never half-written */
let writing = Promise.resolve();
function save() {
  const p = writing.catch(() => {}).then(() =>
    fs.promises.writeFile(DB + ".tmp", JSON.stringify(guests, null, 2)).then(() => fs.promises.rename(DB + ".tmp", DB)));
  writing = p; return p;
}

const hits = new Map(); /* tiny rate limit: 8 submissions per 10 minutes per IP */
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 600000);
  list.push(now); hits.set(ip, list); return list.length > 8;
}
function same(a, b) {
  const h = x => crypto.createHash("sha256").update(String(x)).digest();
  return crypto.timingSafeEqual(h(a), h(b));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => { data += c; if (data.length > 4096) { reject(new Error("too large")); req.destroy(); } });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (code, body, type = "application/json") => {
    const h = { "Content-Type": type + "; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" };
    if (ORIGIN) { h["Access-Control-Allow-Origin"] = ORIGIN; h["Access-Control-Allow-Headers"] = "Content-Type"; }
    res.writeHead(code, h); res.end(body);
  };
  const authed = () => same(url.searchParams.get("token") || (req.headers.authorization || "").replace(/^Bearer /, ""), TOKEN);

  try {
    if (req.method === "OPTIONS") return send(204, "");

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html"))
      return send(200, fs.readFileSync(path.join(__dirname, "index.html")), "text/html");

    if (req.method === "POST" && url.pathname === "/api/rsvp") {
      const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      if (limited(ip)) return send(429, '{"ok":false}');
      let body; try { body = JSON.parse(await readBody(req)); } catch { return send(400, '{"ok":false}'); }
      if (body.website) return send(200, '{"ok":true}'); /* honeypot: pretend it worked */
      const naam = String(body.naam || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);
      if (!naam) return send(400, '{"ok":false}');
      if (!guests.some(g => g.naam.toLowerCase() === naam.toLowerCase())) {
        guests.push({ id: crypto.randomUUID(), naam, komt: "ja", at: new Date().toISOString() });
        await save();
      }
      return send(200, '{"ok":true}');
    }

    if (req.method === "GET" && url.pathname === "/api/guests")
      return authed() ? send(200, JSON.stringify(guests, null, 2)) : send(401, '{"ok":false}');

    if (req.method === "GET" && url.pathname === "/admin") {
      if (!authed()) return send(401, "no", "text/plain");
      const rows = guests.map(g => `<tr><td>${esc(g.naam)}</td><td>${esc(new Date(g.at).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" }))}</td></tr>`).join("");
      return send(200, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>gasten</title>
<style>body{font:16px system-ui;max-width:32rem;margin:2rem auto;padding:0 1rem;color:#2b2b2d}td{padding:.35rem 1.5rem .35rem 0;border-bottom:1px solid #ddd}a{color:inherit}</style>
<h1>${guests.length} ${guests.length === 1 ? "gast" : "gasten"}</h1><table>${rows}</table>
<p><a href="/api/guests?token=${encodeURIComponent(url.searchParams.get("token") || "")}">json</a></p>`, "text/html");
    }

    send(404, '{"ok":false}');
  } catch (e) { console.error(e); send(500, '{"ok":false}'); }
}).listen(PORT, () => console.log("listening on", PORT, "data:", DB));
