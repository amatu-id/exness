# Amatu Trade

Web trading terminal (Portal AMATU app) at https://amatu-id.github.io/exness/ — live prices for forex, metals,
indices, energies, US stocks and crypto, market & pending orders with TP/SL, margin / stop out / swaps,
charts with drawing tools and indicators, and a Personal Area with accounts and virtual deposits.

- No build step: classic scripts in `js/` on `window.AT`, `index.src.html` → `./build.sh` (stamps `?v=<hash>` and `versi.txt`).
- Prices: gTrade pricing websocket/charts API, Hyperliquid xyz markets, Binance spot, open.er-api.com (daily refs).
- Economic calendar via the Supabase Edge Function `amatu-pasar` (`cloud/supabase/functions/amatu-pasar`).
- Data lives in `localStorage` (`exness.*` synced by the portal's `/amatu.js`, `pt.exness.*` device-only).
