# VrijMignotBo #1 – Housewarming

Uitnodiging met een mini-server. Gasten die op "ja" klikken en hun naam invullen worden opgeslagen in een JSON-bestand.

## Bestanden

- `index.html` – de uitnodiging (alles in één bestand)
- `server.js` – serveert de pagina en bewaart de namen (geen dependencies, Node 18+)
- `package.json` – `npm start` start de server

## Starten

```bash
ADMIN_TOKEN=kies-een-lang-geheim node server.js
```

Open daarna http://localhost:3000.

## Gastenlijst bekijken

- Lijst: `/admin?token=JOUW_GEHEIM`
- Ruwe JSON: `/api/guests?token=JOUW_GEHEIM`

De data staat in `data/guests.json` (staat in `.gitignore`, dus komt niet in de repo).

## Instellingen (environment variabelen)

| Variabele | Standaard | Betekenis |
| --- | --- | --- |
| `PORT` | `3000` | poort van de server |
| `DATA_DIR` | `./data` | map met `guests.json`. Zet deze op een persistente schijf (volume), anders raak je de lijst kwijt bij een herstart of nieuwe deploy |
| `ADMIN_TOKEN` | willekeurig bij start | geheim voor `/admin` en `/api/guests`. Stel altijd zelf een lang token in |
| `ALLOWED_ORIGIN` | leeg | alleen nodig als de pagina op een ander adres staat dan de server |

Staat `index.html` ergens anders dan de server, zet dan boven het RSVP-script `window.RSVP_API = "https://jouw-server"` en zet `ALLOWED_ORIGIN` op het adres van de pagina.
