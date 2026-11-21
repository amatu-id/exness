//+------------------------------------------------------------------+
//|                                                        LITUS.mq5 |
//|  Stop-grid pyramid, dibangun dari reel FB "Mr Cracks" (XAUUSD M5)|
//|                                                                  |
//|  Yang terlihat di video:                                         |
//|   - tangga BUY STOP di atas harga & SELL STOP di bawah harga,    |
//|     jarak $1, 20 level per sisi                                  |
//|   - lot berlipat berpasangan: 0.01 0.01 0.02 0.02 0.04 0.04 ...  |
//|     sampai 5.12 5.12 (searah gerakan = pyramid)                  |
//|   - begitu basket untung kecil, SEMUA ditutup + pending dihapus, |
//|     lalu tangga baru dipasang lagi di sekitar harga sekarang     |
//|   - panel: Auto Entry, News Filter, Time Filter LONDON/NY,       |
//|     Spread Check, Smart Lot Sizing, Risk Guard, Auto Break-Even, |
//|     Trailing Stop, Volatility Check, Session Scanner             |
//|  Aturan keluar persis tidak terlihat di video -> di sini dibuat  |
//|  sebagai BE + trailing basket (input bisa diubah).               |
//|                                                                  |
//|  v1.04 hasil belajar history live 20-21 Nov (158 basket):        |
//|   - basket SATU ARAH : 134x, +Rp1,27jt (avg +15,5rb / -2,9rb)    |
//|   - basket DUA SISI terisi (hedge terkunci): 24x, -Rp2,05jt,     |
//|     + bencana Mac sleep -Rp7,5jt juga dua sisi                   |
//|   -> Satu Arah: sisi pertama terisi = pending lawan dihapus,     |
//|      SL server di tiap posisi, ikut naik ke kunci BE/trailing.   |
//+------------------------------------------------------------------+
#property copyright   "LITUS"
#property version     "1.04"
#property description "LITUS: tangga BUY STOP + SELL STOP, lot berlipat berpasangan (pyramid searah gerakan)."
#property description "Keluar per basket: Break-Even + Trailing profit, Risk Guard rugi basket & harian."
#property description "Filter: jam London/NY, spread, volatilitas ATR, berita high-impact (kalender MT5)."

#include <Trade/Trade.mqh>

//--- inputs ---------------------------------------------------------
enum ENUM_LITUS_PRESET
{
   LP_AUTO   = 0,   // AUTO: angka harga mengikuti simbol (BTC otomatis)
   LP_MANUAL = 1    // MANUAL: pakai semua input di bawah
};
input group "=== Preset ==="
input ENUM_LITUS_PRESET InpPreset = LP_AUTO; // Preset (AUTO: BTC pakai angka BTC, XAU/lainnya pakai input)
input bool     InpWeekend       = false;  // Trading Sabtu-Minggu (AUTO BTC: selalu ON)

input group "=== Tangga (grid) ==="
input int      InpLevels        = 20;     // Level per sisi (BUY STOP di atas, SELL STOP di bawah)
input double   InpStep          = 1.0;    // Jarak antar level (harga, XAU: $1)
input double   InpStartDist     = 1.0;    // Jarak level pertama dari harga (Ask/Bid)
input double   InpBaseLot       = 0.01;   // Lot dasar (level 1)
input double   InpLotMult       = 2.0;    // Pengali lot
input int      InpLotRepeat     = 2;      // Lot sama diulang N level (video: 2 -> 0.01 0.01 0.02 0.02 ...)
input double   InpMaxLot        = 5.12;   // Lot maksimum per level
input bool     InpBothSides     = true;   // Pasang dua sisi (false = hanya sisi InpOnlySide)
input int      InpOnlySide      = 0;      // Jika satu sisi: 0 = BUY, 1 = SELL

input group "=== Smart Lot Sizing ==="
input bool     InpSmartLot      = false;  // Lot dasar otomatis dari balance
input double   InpBalancePerBase = 1000;  // Balance (mata uang akun) per 0.01 lot dasar

input group "=== Keluar basket (dalam 'gerak harga x lot dasar') ==="
// Semua angka di grup ini = untung/rugi setara harga bergerak X dengan lot dasar.
// XAU lot 0.01: 1.0 = $1. Otomatis dikonversi ke mata uang akun (IDR/USD) dan ikut Smart Lot.
input bool     InpUseBE         = true;   // Auto Break-Even basket
input double   InpBETrigger     = 0.60;   // BE aktif saat untung basket >=
input double   InpBELock        = 0.15;   // ... lalu basket ditutup bila untung turun ke
input bool     InpUseTrail      = true;   // Trailing Stop basket (profit)
input double   InpTrailStart    = 1.20;   // Trailing aktif saat untung puncak >=
input double   InpTrailGiveback = 30.0;   // Tutup bila untung turun % ini dari puncak
input double   InpTrailMaxGive  = 0;      // Batas giveback maksimum (0 = tanpa batas)
input double   InpBasketTP      = 0;      // TP basket tetap (0 = off)
input int      InpMaxBasketMin  = 0;      // Tutup basket setelah N menit (0 = off)

input group "=== Risk Guard ==="
input double   InpMaxBasketLossPct = 10;  // Tutup basket bila rugi >= % balance (0 = off)
input double   InpMaxDailyLossPct  = 20;  // Stop hari ini bila equity turun % dari awal hari (0 = off)
input double   InpMarginUsePct     = 80;  // Level dibatasi: margin semua lot satu sisi <= % free margin
input double   InpMaxTotalLots     = 0;   // Batas total lot per sisi (0 = off)
input bool     InpDemoOnly         = true; // Hanya buka tangga baru di akun DEMO

input group "=== Filter ==="
input bool     InpUseTime       = true;   // Time Filter (jam server)
input int      InpStartHour     = 7;      // Mulai (London buka, server Exness = GMT)
input int      InpEndHour       = 21;     // Selesai (NY sore)
input int      InpFridayStop    = 20;     // Jumat: tidak buka tangga baru mulai jam ini (0 = off)
input double   InpMaxSpread     = 0.50;   // Spread maksimum (harga, 0 = off)
input bool     InpUseATR        = true;   // Volatility Check
input ENUM_TIMEFRAMES InpATRTF  = PERIOD_M5; // TF ATR
input int      InpATRPeriod     = 14;     // Periode ATR
input double   InpATRMin        = 0.40;   // ATR minimum (harga)
input double   InpATRMax        = 8.0;    // ATR maksimum (harga, 0 = off)
input bool     InpUseNews       = true;   // News Filter (kalender MT5, hanya live)
input string   InpNewsCcy       = "USD";  // Mata uang berita (pisah koma)
input int      InpNewsBefore    = 30;     // Menit sebelum berita: tidak buka tangga
input int      InpNewsAfter     = 30;     // Menit sesudah berita
input bool     InpDeleteBlocked = true;   // Hapus tangga kosong (tanpa posisi) saat filter menutup

input group "=== Lain-lain ==="
input int      InpCooldownSec   = 5;      // Jeda setelah basket ditutup (detik)
input ulong    InpMagic         = 20261120; // Magic number
input int      InpSlippage      = 30;     // Deviasi (point)
input bool     InpShowPanel     = true;   // Tampilkan panel

input group "=== Pengaman bila MT5/Mac mati (sleep, putus) ==="
// v1.03: order STOP ada di server, tetap terpicu walau MT5 beku (Mac ditutup) -> basket tanpa pengelola.
input int      InpPendExpiryMin = 10;     // Pending kedaluwarsa di SERVER bila EA tidak memperpanjang (menit, 0 = GTC)
input double   InpEmergSteps    = 10;     // SL darurat di server tiap order = N x jarak level (0 = off)

input group "=== v1.04 Satu Arah (hasil belajar history) ==="
input bool     InpOneWay        = true;   // Sisi pertama terisi -> hapus semua pending sisi lawan (tidak pernah hedge terkunci)
input double   InpSLSteps       = 2.0;    // SL server: level terisi terjauh -/+ N x jarak level (0 = off, pakai SL darurat)
input bool     InpSLFollowLock  = true;   // SL server ikut naik ke harga kunci BE/trailing (aman walau MT5 mati)
input ENUM_TIMEFRAMES InpTrendTF = PERIOD_H1; // Filter tren: TF EMA
input int      InpTrendEMA      = 0;      // Filter tren: periode EMA (0 = off). Harga > EMA = hanya BUY STOP, < EMA = hanya SELL STOP
input int      InpLossCooldownSec = 0;    // Jeda setelah basket RUGI (detik) - kurangi churn di pasar choppy

//--- globals --------------------------------------------------------
// v1.02: angka dalam satuan harga dipakai lewat P_* (hasil preset), bukan langsung dari input
double   P_Step, P_Start, P_MaxSpread, P_ATRMin, P_ATRMax, P_BETrig, P_BELock, P_TrailStart, P_TrailMaxGive, P_BasketTP;
bool     P_UseTime, P_Weekend;
int      P_Levels, P_TrendEMA;      // v1.04
double   P_TrailGive;
int      P_FridayStop;
string   g_preset = "MANUAL";
CTrade   trade;
string   g_sym;
int      g_atr = INVALID_HANDLE;
int      g_ema = INVALID_HANDLE;
double   g_peak = 0;            // untung puncak basket (mata uang akun)
datetime g_basketStart = 0;
bool     g_hadPos = false;
datetime g_cooldown = 0;
datetime g_closedUntil = 0;     // backoff market closed
int      g_day = -1;
double   g_dayStart = 0;
bool     g_dayStop = false;
string   g_lastClose = "-";
double   g_dayPL = 0;
string   g_gvPeak, g_gvStart;
// status untuk panel
string   st_news = "ACTIVE", st_time = "", st_spread = "", st_vol = "", st_lot = "", st_state = "SCANNING";
string   st_be = "ON", st_trail = "ON", st_risk = "ENABLED", st_block = "";
double   g_lock = 0;
bool     g_lockOn = false;
datetime g_lastProc = 0;        // v1.03: deteksi jeda (MT5 beku / Mac sleep)
datetime g_lastKeep = 0;
string   g_lastWhy = "#";
// cache berita
datetime g_newsT[];
string   g_newsN[];
datetime g_newsLoaded = 0;

//+------------------------------------------------------------------+
// Preset: BTC bergerak ~25x emas (ATR M5 ~$120 vs ~$5, spread $6.4 vs $0.24) dan buka 24/7
void ResolvePreset()
{
   P_Step = InpStep; P_Start = InpStartDist; P_MaxSpread = InpMaxSpread; P_ATRMin = InpATRMin; P_ATRMax = InpATRMax;
   P_BETrig = InpBETrigger; P_BELock = InpBELock; P_TrailStart = InpTrailStart; P_TrailMaxGive = InpTrailMaxGive; P_BasketTP = InpBasketTP;
   P_UseTime = InpUseTime; P_FridayStop = InpFridayStop; P_Weekend = InpWeekend;
   P_Levels = InpLevels; P_TrendEMA = InpTrendEMA; P_TrailGive = InpTrailGiveback;
   g_preset = "MANUAL";
   if(InpPreset != LP_AUTO) return;
   string s = g_sym;
   StringToUpper(s);
   if(StringFind(s, "BTC") >= 0)
   {
      // v1.04 dari backtest tick nyata 15 Agu-21 Nov 2026 (IS s/d 1 Okt, OOS sesudahnya, keduanya untung):
      // 1 level, jarak $50, SL 2 step ($100), BE 30/5, trailing dari 60 lepas 50%, hanya searah EMA200 H1.
      // (v1.03: 20 level x $25, BE 15/4, trail 30 -> -91% di 20 Okt-11 Nov)
      P_Step = 50; P_Start = 50; P_MaxSpread = 12; P_ATRMin = 10; P_ATRMax = 500;
      P_BETrig = 30; P_BELock = 5; P_TrailStart = 60; P_TrailGive = 50;
      P_Levels = 1; P_TrendEMA = 200;
      P_TrailMaxGive = InpTrailMaxGive * 25; P_BasketTP = InpBasketTP * 25;
      P_UseTime = false; P_FridayStop = 0; P_Weekend = true;
      g_preset = "AUTO BTC";
   }
   else if(StringFind(s, "XAU") >= 0) g_preset = "AUTO XAU";
   else g_preset = "AUTO (input)";
}

double Pt()      { return SymbolInfoDouble(g_sym, SYMBOL_POINT); }
double TickSz()  { double t = SymbolInfoDouble(g_sym, SYMBOL_TRADE_TICK_SIZE); return t > 0 ? t : Pt(); }
double NP(double p) { double t = TickSz(); return NormalizeDouble(MathRound(p / t) * t, (int)SymbolInfoInteger(g_sym, SYMBOL_DIGITS)); }

double NormLot(double v)
{
   double mn = SymbolInfoDouble(g_sym, SYMBOL_VOLUME_MIN);
   double mx = SymbolInfoDouble(g_sym, SYMBOL_VOLUME_MAX);
   double st = SymbolInfoDouble(g_sym, SYMBOL_VOLUME_STEP);
   if(st <= 0) st = 0.01;
   v = MathFloor(v / st + 1e-9) * st;
   if(v < mn) v = mn;
   if(v > mx) v = mx;
   return NormalizeDouble(v, 2);
}

double BaseLot()
{
   double b = InpBaseLot;
   if(InpSmartLot && InpBalancePerBase > 0)
      b = 0.01 * MathFloor(AccountInfoDouble(ACCOUNT_BALANCE) / InpBalancePerBase);
   return NormLot(b);
}

double LotAt(int i, double base)
{
   int rep = MathMax(1, InpLotRepeat);
   double l = base * MathPow(InpLotMult, (double)(i / rep));
   double cap = InpMaxLot > 0 ? InpMaxLot : l;
   if(InpSmartLot && InpBaseLot > 0) cap *= base / InpBaseLot;   // cap ikut skala lot pintar
   return NormLot(MathMin(l, cap));
}

// nilai uang (mata uang akun) dari gerak harga 'dist' dengan lot dasar
double MoneyOf(double dist)
{
   double tv = SymbolInfoDouble(g_sym, SYMBOL_TRADE_TICK_VALUE);
   double ts = TickSz();
   if(tv <= 0 || ts <= 0) return dist;
   return dist / ts * tv * BaseLot();
}

bool IsMine(ulong magic, string sym) { return magic == InpMagic && sym == g_sym; }

//+------------------------------------------------------------------+
int CountPos(double &profit, double &lotB, double &lotS, int &nB, int &nS)
{
   profit = 0; lotB = 0; lotS = 0; nB = 0; nS = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t == 0 || !PositionSelectByTicket(t)) continue;
      if(!IsMine(PositionGetInteger(POSITION_MAGIC), PositionGetString(POSITION_SYMBOL))) continue;
      profit += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      double v = PositionGetDouble(POSITION_VOLUME);
      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) { lotB += v; nB++; }
      else { lotS += v; nS++; }
   }
   return nB + nS;
}

int CountPend(int &nB, int &nS)
{
   nB = 0; nS = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong t = OrderGetTicket(i);
      if(t == 0 || !OrderSelect(t)) continue;
      if(!IsMine(OrderGetInteger(ORDER_MAGIC), OrderGetString(ORDER_SYMBOL))) continue;
      long ty = OrderGetInteger(ORDER_TYPE);
      if(ty == ORDER_TYPE_BUY_STOP) nB++;
      else if(ty == ORDER_TYPE_SELL_STOP) nS++;
   }
   return nB + nS;
}

void DeletePend()
{
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong t = OrderGetTicket(i);
      if(t == 0 || !OrderSelect(t)) continue;
      if(!IsMine(OrderGetInteger(ORDER_MAGIC), OrderGetString(ORDER_SYMBOL))) continue;
      if(!trade.OrderDelete(t))
         PrintFormat("LITUS: gagal hapus order %I64u ret=%u %s", t, trade.ResultRetcode(), trade.ResultRetcodeDescription());
   }
}

bool CloseAll(string why)
{
   double pr, lb, ls; int nb, ns;
   CountPos(pr, lb, ls, nb, ns);
   PrintFormat("LITUS: tutup basket (%s) posisi=%d lot B %.2f S %.2f P/L %.2f puncak %.2f", why, nb + ns, lb, ls, pr, g_peak);
   g_lastClose = StringFormat("%s %s %.2f", TimeToString(TimeCurrent(), TIME_MINUTES), why, pr);
   for(int pass = 0; pass < 5; pass++)
   {
      DeletePend();                      // pending dulu, supaya tidak ada yang terpicu saat menutup
      // tutup lot terbesar dulu (eksposur terbesar)
      ulong tk[]; double vol[]; int n = 0;
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong t = PositionGetTicket(i);
         if(t == 0 || !PositionSelectByTicket(t)) continue;
         if(!IsMine(PositionGetInteger(POSITION_MAGIC), PositionGetString(POSITION_SYMBOL))) continue;
         ArrayResize(tk, n + 1); ArrayResize(vol, n + 1);
         tk[n] = t; vol[n] = PositionGetDouble(POSITION_VOLUME); n++;
      }
      if(n == 0)
      {
         int pb, ps;
         if(CountPend(pb, ps) == 0) break;
         continue;
      }
      for(int a = 0; a < n - 1; a++)
         for(int b = a + 1; b < n; b++)
            if(vol[b] > vol[a]) { double v = vol[a]; vol[a] = vol[b]; vol[b] = v; ulong x = tk[a]; tk[a] = tk[b]; tk[b] = x; }
      for(int k = 0; k < n; k++)
         if(!trade.PositionClose(tk[k], InpSlippage))
         {
            uint rc = trade.ResultRetcode();
            PrintFormat("LITUS: gagal tutup %I64u ret=%u %s", tk[k], rc, trade.ResultRetcodeDescription());
            if(rc == TRADE_RETCODE_MARKET_CLOSED) { g_closedUntil = TimeCurrent() + 60; return false; }
         }
   }
   double p2, l2, s2; int b2, n2;
   bool done = CountPos(p2, l2, s2, b2, n2) == 0;
   if(done)
   {
      g_peak = 0; g_lockOn = false; g_hadPos = false; g_basketStart = 0;
      GlobalVariableDel(g_gvPeak); GlobalVariableDel(g_gvStart);
      g_cooldown = TimeCurrent() + InpCooldownSec;
      if(InpLossCooldownSec > 0 && pr < 0) g_cooldown = TimeCurrent() + InpLossCooldownSec;
   }
   return done;
}

//+------------------------------------------------------------------+
void LoadNews()
{
   ArrayResize(g_newsT, 0); ArrayResize(g_newsN, 0);
   g_newsLoaded = TimeCurrent();
   string ccy[]; int nc = StringSplit(InpNewsCcy, ',', ccy);
   for(int c = 0; c < nc; c++)
   {
      string cur = ccy[c]; StringTrimLeft(cur); StringTrimRight(cur);
      if(cur == "") continue;
      MqlCalendarValue v[];
      if(CalendarValueHistory(v, TimeCurrent() - 6 * 3600, TimeCurrent() + 36 * 3600, NULL, cur) <= 0) continue;
      for(int i = 0; i < ArraySize(v); i++)
      {
         MqlCalendarEvent ev;
         if(!CalendarEventById(v[i].event_id, ev)) continue;
         if(ev.importance != CALENDAR_IMPORTANCE_HIGH) continue;
         int k = ArraySize(g_newsT);
         ArrayResize(g_newsT, k + 1); ArrayResize(g_newsN, k + 1);
         g_newsT[k] = v[i].time; g_newsN[k] = cur + " " + ev.name;
      }
   }
}

bool NewsBlock(string &what)
{
   what = "";
   if(!InpUseNews || MQLInfoInteger(MQL_TESTER) || MQLInfoInteger(MQL_OPTIMIZATION)) return false;
   if(TimeCurrent() - g_newsLoaded > 600) LoadNews();
   datetime now = TimeCurrent();
   for(int i = 0; i < ArraySize(g_newsT); i++)
      if(now >= g_newsT[i] - InpNewsBefore * 60 && now <= g_newsT[i] + InpNewsAfter * 60)
      { what = g_newsN[i] + " " + TimeToString(g_newsT[i], TIME_MINUTES); return true; }
   return false;
}

bool InHours(int h)
{
   if(InpStartHour == InpEndHour) return true;
   if(InpStartHour < InpEndHour) return h >= InpStartHour && h < InpEndHour;
   return h >= InpStartHour || h < InpEndHour;        // melewati tengah malam
}

// true = boleh pasang tangga baru
bool FiltersOK(string &why)
{
   why = "";
   MqlDateTime t; TimeToStruct(TimeCurrent(), t);
   double ask = SymbolInfoDouble(g_sym, SYMBOL_ASK), bid = SymbolInfoDouble(g_sym, SYMBOL_BID);
   double spr = ask - bid;
   bool ok = true;

   st_time = P_UseTime ? StringFormat("LONDON/NY %02d-%02d", InpStartHour, InpEndHour) : (P_Weekend ? "OFF (24/7)" : "OFF (24 jam)");
   if(P_UseTime && !InHours(t.hour)) { st_time += " TUTUP"; if(ok) why = "di luar jam"; ok = false; }
   if(t.day_of_week == 5 && P_FridayStop > 0 && t.hour >= P_FridayStop) { st_time += " JUMAT"; if(ok) why = "Jumat sore"; ok = false; }
   if(!P_Weekend && (t.day_of_week == 0 || t.day_of_week == 6)) { st_time += " LIBUR"; if(ok) why = "akhir pekan"; ok = false; }

   st_spread = StringFormat("%.2f", spr);
   if(P_MaxSpread > 0 && spr > P_MaxSpread) { st_spread += " TINGGI"; if(ok) why = "spread tinggi"; ok = false; }
   else st_spread = "OK " + st_spread;

   if(InpUseATR && g_atr != INVALID_HANDLE)
   {
      double a[1];
      if(CopyBuffer(g_atr, 0, 1, 1, a) == 1)
      {
         st_vol = StringFormat("ATR %.2f", a[0]);
         if(a[0] < P_ATRMin) { st_vol += " SEPI"; if(ok) why = "volatilitas rendah"; ok = false; }
         else if(P_ATRMax > 0 && a[0] > P_ATRMax) { st_vol += " LIAR"; if(ok) why = "volatilitas ekstrem"; ok = false; }
         else st_vol = "OK " + st_vol;
      }
      else st_vol = "menunggu data";
   }
   else st_vol = "OFF";

   string nw;
   if(NewsBlock(nw)) { st_news = "BLOK " + nw; if(ok) why = "berita"; ok = false; }
   else st_news = InpUseNews ? (MQLInfoInteger(MQL_TESTER) ? "ACTIVE (tester: off)" : "ACTIVE") : "OFF";

   if(AccountInfoInteger(ACCOUNT_LOGIN) <= 0 || !TerminalInfoInteger(TERMINAL_CONNECTED)) { if(ok) why = "belum terhubung"; ok = false; }
   else if(AccountInfoInteger(ACCOUNT_MARGIN_MODE) != ACCOUNT_MARGIN_MODE_RETAIL_HEDGING) { if(ok) why = "akun netting (butuh hedging)"; ok = false; }
   if(g_dayStop) { if(ok) why = "batas rugi harian"; ok = false; }
   if(InpDemoOnly && AccountInfoInteger(ACCOUNT_TRADE_MODE) != ACCOUNT_TRADE_MODE_DEMO) { if(ok) why = "akun REAL (InpDemoOnly)"; ok = false; }
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED)) { if(ok) why = "Algo Trading mati"; ok = false; }
   if(TimeCurrent() < g_closedUntil) { if(ok) why = "market tutup"; ok = false; }
   return ok;
}

// perkiraan margin (mata uang akun) untuk vol lot di harga px
double MarginEst(double vol, double px)
{
   long lev = AccountInfoInteger(ACCOUNT_LEVERAGE);
   double tv = SymbolInfoDouble(g_sym, SYMBOL_TRADE_TICK_VALUE), ts = TickSz();
   if(lev <= 0 || tv <= 0 || ts <= 0) return 0;
   return vol * px / (double)lev * tv / ts;
}

// v1.03: kedaluwarsa pending di server
bool ExpiryOK()
{
   if(InpPendExpiryMin <= 0) return false;
   long m = SymbolInfoInteger(g_sym, SYMBOL_EXPIRATION_MODE);
   return (m & SYMBOL_EXPIRATION_SPECIFIED) != 0;
}
datetime ExpiryTime() { return TimeCurrent() + InpPendExpiryMin * 60; }

// perpanjang kedaluwarsa pending selama EA hidup (tiap 30 detik cek, perpanjang bila sisa < separuh)
void KeepPendAlive()
{
   if(!ExpiryOK() || TimeCurrent() - g_lastKeep < 30) return;
   g_lastKeep = TimeCurrent();
   datetime lim = TimeCurrent() + InpPendExpiryMin * 30;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong t = OrderGetTicket(i);
      if(t == 0 || !OrderSelect(t)) continue;
      if(!IsMine(OrderGetInteger(ORDER_MAGIC), OrderGetString(ORDER_SYMBOL))) continue;
      datetime ex = (datetime)OrderGetInteger(ORDER_TIME_EXPIRATION);
      if(OrderGetInteger(ORDER_TYPE_TIME) == ORDER_TIME_SPECIFIED && ex > lim) continue;
      if(!trade.OrderModify(t, OrderGetDouble(ORDER_PRICE_OPEN), OrderGetDouble(ORDER_SL), OrderGetDouble(ORDER_TP),
                            ORDER_TIME_SPECIFIED, ExpiryTime()))
         PrintFormat("LITUS: gagal perpanjang order %I64u ret=%u %s", t, trade.ResultRetcode(), trade.ResultRetcodeDescription());
   }
}

// SL darurat untuk posisi LITUS yang belum punya SL (mis. basket lama sebelum v1.03)
void EnsureEmergSL()
{
   if(InpEmergSteps <= 0) return;
   double d = InpEmergSteps * P_Step;
   double minStop = (double)SymbolInfoInteger(g_sym, SYMBOL_TRADE_STOPS_LEVEL) * Pt();
   double bid = SymbolInfoDouble(g_sym, SYMBOL_BID), ask = SymbolInfoDouble(g_sym, SYMBOL_ASK);
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t == 0 || !PositionSelectByTicket(t)) continue;
      if(!IsMine(PositionGetInteger(POSITION_MAGIC), PositionGetString(POSITION_SYMBOL))) continue;
      if(PositionGetDouble(POSITION_SL) > 0) continue;
      double op = PositionGetDouble(POSITION_PRICE_OPEN), sl;
      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) sl = NP(MathMin(op - d, bid - minStop - Pt()));
      else sl = NP(MathMax(op + d, ask + minStop + Pt()));
      if(!trade.PositionModify(t, sl, PositionGetDouble(POSITION_TP)))
         PrintFormat("LITUS: gagal pasang SL darurat %I64u ret=%u %s", t, trade.ResultRetcode(), trade.ResultRetcodeDescription());
   }
}

// v1.04: hapus pending satu jenis (BUY STOP / SELL STOP)
int DeletePendType(ENUM_ORDER_TYPE typ)
{
   int n = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong t = OrderGetTicket(i);
      if(t == 0 || !OrderSelect(t)) continue;
      if(!IsMine(OrderGetInteger(ORDER_MAGIC), OrderGetString(ORDER_SYMBOL))) continue;
      if(OrderGetInteger(ORDER_TYPE) != typ) continue;
      if(trade.OrderDelete(t)) n++;
      else PrintFormat("LITUS: gagal hapus order %I64u ret=%u %s", t, trade.ResultRetcode(), trade.ResultRetcodeDescription());
   }
   return n;
}

// v1.04: SL server per sisi = max(level terisi terjauh - N x step, harga kunci BE/trailing). Tidak pernah dilonggarkan.
void SyncSL(int nb, int ns)
{
   if(InpSLSteps <= 0 && !InpSLFollowLock) return;
   double tv = SymbolInfoDouble(g_sym, SYMBOL_TRADE_TICK_VALUE), ts = TickSz();
   double vpp = (tv > 0 && ts > 0) ? tv / ts : 0;        // uang per 1.0 harga per 1 lot
   double minStop = (double)MathMax(SymbolInfoInteger(g_sym, SYMBOL_TRADE_STOPS_LEVEL), SymbolInfoInteger(g_sym, SYMBOL_TRADE_FREEZE_LEVEL)) * Pt();
   double bid = SymbolInfoDouble(g_sym, SYMBOL_BID), ask = SymbolInfoDouble(g_sym, SYMBOL_ASK);
   double minMove = MathMax(5 * TickSz(), 0.05 * P_Step);
   for(int side = 0; side < 2; side++)
   {
      bool isB = side == 0;
      if((isB ? nb : ns) == 0) continue;
      double sumL = 0, sumLO = 0, ext = isB ? -DBL_MAX : DBL_MAX;
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong t = PositionGetTicket(i);
         if(t == 0 || !PositionSelectByTicket(t)) continue;
         if(!IsMine(PositionGetInteger(POSITION_MAGIC), PositionGetString(POSITION_SYMBOL))) continue;
         if((PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) != isB) continue;
         double v = PositionGetDouble(POSITION_VOLUME), op = PositionGetDouble(POSITION_PRICE_OPEN);
         sumL += v; sumLO += v * op;
         ext = isB ? MathMax(ext, op) : MathMin(ext, op);
      }
      if(sumL <= 0) continue;
      double want = 0;
      if(InpSLSteps > 0) want = isB ? ext - InpSLSteps * P_Step : ext + InpSLSteps * P_Step;
      // kunci BE/trailing basket -> harga di mana P/L basket = kunci (hanya bila satu sisi saja)
      if(InpSLFollowLock && g_lockOn && vpp > 0 && (nb == 0 || ns == 0))
      {
         double lp = isB ? (g_lock / vpp + sumLO) / sumL : (sumLO - g_lock / vpp) / sumL;
         if(want == 0) want = lp;
         else want = isB ? MathMax(want, lp) : MathMin(want, lp);
      }
      if(want <= 0) continue;
      // batas stops level: kalau terlalu dekat harga, EA yang menutup (ManageBasket), SL dipasang sedekat mungkin
      if(isB) want = MathMin(want, bid - minStop - Pt());
      else    want = MathMax(want, ask + minStop + Pt());
      want = NP(want);
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong t = PositionGetTicket(i);
         if(t == 0 || !PositionSelectByTicket(t)) continue;
         if(!IsMine(PositionGetInteger(POSITION_MAGIC), PositionGetString(POSITION_SYMBOL))) continue;
         if((PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) != isB) continue;
         double cur = PositionGetDouble(POSITION_SL);
         bool better = cur <= 0 || (isB ? want >= cur + minMove : want <= cur - minMove);
         if(!better) continue;
         if(!trade.PositionModify(t, want, PositionGetDouble(POSITION_TP)))
            PrintFormat("LITUS: gagal geser SL %I64u ke %.2f ret=%u %s", t, want, trade.ResultRetcode(), trade.ResultRetcodeDescription());
      }
   }
}

// v1.04: P/L basket yang ditutup server (SL) / manual, dari history deal
double ClosedPL(datetime from)
{
   double pl = 0;
   if(from <= 0 || !HistorySelect(from - 5, TimeCurrent() + 5)) return 0;
   for(int i = HistoryDealsTotal() - 1; i >= 0; i--)
   {
      ulong d = HistoryDealGetTicket(i);
      if(d == 0) continue;
      if(!IsMine(HistoryDealGetInteger(d, DEAL_MAGIC), HistoryDealGetString(d, DEAL_SYMBOL))) continue;
      pl += HistoryDealGetDouble(d, DEAL_PROFIT) + HistoryDealGetDouble(d, DEAL_SWAP) + HistoryDealGetDouble(d, DEAL_COMMISSION);
   }
   return pl;
}

//+------------------------------------------------------------------+
void PlaceGrid()
{
   double ask = SymbolInfoDouble(g_sym, SYMBOL_ASK), bid = SymbolInfoDouble(g_sym, SYMBOL_BID);
   if(ask <= 0 || bid <= 0) return;
   double base = BaseLot();
   double minStop = (double)SymbolInfoInteger(g_sym, SYMBOL_TRADE_STOPS_LEVEL) * Pt();
   double start = MathMax(P_Start, minStop + Pt());

   // Risk Guard: berapa level muat di margin (asumsi seluruh satu sisi terisi)
   int n = MathMax(1, P_Levels);
   long lim = AccountInfoInteger(ACCOUNT_LIMIT_ORDERS);
   int sides = InpBothSides ? 2 : 1;
   if(lim > 0) n = (int)MathMin(n, (lim - PositionsTotal() - OrdersTotal()) / sides);
   double fm = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double cum = 0; int allowed = 0;
   for(int i = 0; i < n; i++)
   {
      double l = LotAt(i, base);
      if(InpMaxTotalLots > 0 && cum + l > InpMaxTotalLots + 1e-9) break;
      double m = 0;
      if(InpMarginUsePct > 0)
      {
         // v1.01: OrderCalcMargin bisa gagal/0 sesaat setelah konek -> pakai yang lebih besar dari
         // hasilnya dan perkiraan sendiri (lot x harga / leverage, dikonversi lewat tick value)
         double est = MarginEst(cum + l, ask);
         if(!OrderCalcMargin(ORDER_TYPE_BUY, g_sym, cum + l, ask, m)) m = 0;
         m = MathMax(m, est);
         if(m <= 0 || fm <= 0 || m > fm * InpMarginUsePct / 100.0) break;
      }
      cum += l; allowed++;
   }
   if(allowed == 0)
   {
      st_state = "MARGIN KURANG";
      static datetime warned = 0;
      if(TimeCurrent() - warned > 600) { warned = TimeCurrent(); Print("LITUS: free margin tidak cukup untuk 1 level pun"); }
      return;
   }

   bool doB = InpBothSides || InpOnlySide == 0;
   bool doS = InpBothSides || InpOnlySide == 1;
   if(g_ema != INVALID_HANDLE)
   {  // v1.04: hanya searah tren
      double e[1];
      if(BarsCalculated(g_ema) < P_TrendEMA || CopyBuffer(g_ema, 0, 1, 1, e) != 1 || e[0] <= 0 || e[0] == EMPTY_VALUE)
      {  // EMA belum siap -> jangan menebak arah
         static datetime w = 0;
         if(TimeCurrent() - w > 3600) { w = TimeCurrent(); PrintFormat("LITUS: EMA tren belum siap (bars %d)", BarsCalculated(g_ema)); }
         return;
      }
      static datetime dbg = 0;
      if(MQLInfoInteger(MQL_TESTER) && TimeCurrent() - dbg > 86400) { dbg = TimeCurrent(); PrintFormat("LITUS dbg EMA %.2f mid %.2f", e[0], (ask + bid) / 2); }
      double mid = (ask + bid) / 2;
      if(mid > e[0]) doS = false; else doB = false;
      if(!doB && !doS) return;
   }
   double b0 = NP(ask + start), s0 = NP(bid - start);
   int placed = 0;
   bool useEx = ExpiryOK();
   ENUM_ORDER_TYPE_TIME tt = useEx ? ORDER_TIME_SPECIFIED : ORDER_TIME_GTC;
   datetime ex = useEx ? ExpiryTime() : 0;
   double ed = InpEmergSteps > 0 ? InpEmergSteps * P_Step : 0;
   if(InpSLSteps > 0) ed = InpSLSteps * P_Step;     // v1.04: tiap pending langsung bawa SL basket
   for(int i = 0; i < allowed; i++)
   {
      double l = LotAt(i, base);
      if(doB)
      {
         double p = NP(b0 + i * P_Step);
         if(trade.BuyStop(l, p, g_sym, ed > 0 ? NP(p - ed) : 0, 0, tt, ex, StringFormat("LITUS B%d", i + 1))) placed++;
         else if(CheckFail()) return;
      }
      if(doS)
      {
         double p = NP(s0 - i * P_Step);
         if(trade.SellStop(l, p, g_sym, ed > 0 ? NP(p + ed) : 0, 0, tt, ex, StringFormat("LITUS S%d", i + 1))) placed++;
         else if(CheckFail()) return;
      }
   }
   PrintFormat("LITUS: tangga baru %d order (%d level/sisi, lot dasar %.2f, total %.2f lot/sisi) Ask %.2f Bid %.2f, kedaluwarsa %s, SL %.2f",
               placed, allowed, base, cum, ask, bid, useEx ? IntegerToString(InpPendExpiryMin) + " mnt" : "GTC", ed);
   if(allowed < P_Levels)
      PrintFormat("LITUS: Risk Guard memotong level %d -> %d (margin/limit)", P_Levels, allowed);
}

// true = hentikan pemasangan
bool CheckFail()
{
   uint rc = trade.ResultRetcode();
   PrintFormat("LITUS: order gagal ret=%u %s", rc, trade.ResultRetcodeDescription());
   if(rc == TRADE_RETCODE_MARKET_CLOSED || rc == TRADE_RETCODE_TRADE_DISABLED)
   { g_closedUntil = TimeCurrent() + 60; DeletePend(); return true; }
   if(rc == TRADE_RETCODE_LIMIT_ORDERS || rc == TRADE_RETCODE_NO_MONEY) return true;
   return false;
}

//+------------------------------------------------------------------+
void ManageBasket(double profit)
{
   if(!g_hadPos)
   {
      g_hadPos = true;
      if(g_basketStart == 0) g_basketStart = TimeCurrent();
      GlobalVariableSet(g_gvStart, (double)g_basketStart);
   }
   if(profit > g_peak) { g_peak = profit; GlobalVariableSet(g_gvPeak, g_peak); }

   double lock = 0; bool on = false;
   if(InpUseBE && g_peak >= MoneyOf(P_BETrig))
   { lock = MoneyOf(P_BELock); on = true; st_be = "LOCKED"; }
   else st_be = InpUseBE ? "ON" : "OFF";
   if(InpUseTrail && g_peak >= MoneyOf(P_TrailStart))
   {
      double give = g_peak * P_TrailGive / 100.0;
      if(P_TrailMaxGive > 0) give = MathMin(give, MoneyOf(P_TrailMaxGive));
      double tl = g_peak - give;
      if(!on || tl > lock) lock = tl;
      on = true; st_trail = "AKTIF";
   }
   else st_trail = InpUseTrail ? "ON" : "OFF";
   g_lock = lock; g_lockOn = on;

   if(on && profit <= lock) { CloseAll(st_trail == "AKTIF" ? "trailing" : "break-even"); return; }
   if(P_BasketTP > 0 && profit >= MoneyOf(P_BasketTP)) { CloseAll("TP basket"); return; }
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   if(InpMaxBasketLossPct > 0 && profit <= -bal * InpMaxBasketLossPct / 100.0) { CloseAll("Risk Guard basket"); return; }
   if(InpMaxBasketMin > 0 && g_basketStart > 0 && TimeCurrent() - g_basketStart >= InpMaxBasketMin * 60)
   { CloseAll("waktu basket"); return; }
}

void DayCheck()
{
   MqlDateTime t; TimeToStruct(TimeCurrent(), t);
   if(t.day_of_year != g_day)
   {
      g_day = t.day_of_year;
      g_dayStart = AccountInfoDouble(ACCOUNT_EQUITY);
      g_dayStop = false;
   }
   double eq = AccountInfoDouble(ACCOUNT_EQUITY);
   g_dayPL = eq - g_dayStart;
   if(!g_dayStop && InpMaxDailyLossPct > 0 && g_dayStart > 0 && eq <= g_dayStart * (1 - InpMaxDailyLossPct / 100.0))
   {
      g_dayStop = true;
      PrintFormat("LITUS: batas rugi harian %.1f%% tercapai, berhenti sampai besok", InpMaxDailyLossPct);
      CloseAll("rugi harian");
   }
}

//+------------------------------------------------------------------+
void Process()
{
   DayCheck();
   double profit, lb, ls; int nb, ns;
   int np = CountPos(profit, lb, ls, nb, ns);
   int pb, ps;
   int no = CountPend(pb, ps);
   // v1.03: EA sempat tidak jalan (Mac sleep / MT5 beku) -> catat, tangga kosong lama dibangun ulang
   if(g_lastProc > 0 && TimeCurrent() - g_lastProc > 120)
   {
      PrintFormat("LITUS: EA tidak berjalan %d detik (Mac sleep / MT5 beku / putus). Posisi %d, pending %d",
                  (int)(TimeCurrent() - g_lastProc), np, no);
      if(np == 0 && no > 0) { DeletePend(); no = CountPend(pb, ps); }
   }
   g_lastProc = TimeCurrent();
   KeepPendAlive();
   if(np > 0 && InpOneWay)
   {  // v1.04: sisi pertama terisi -> pending lawan dihapus (data: dua sisi terisi = sumber semua rugi besar)
      int d = 0;
      if(nb > 0 && ps > 0) d += DeletePendType(ORDER_TYPE_SELL_STOP);
      if(ns > 0 && pb > 0) d += DeletePendType(ORDER_TYPE_BUY_STOP);
      if(d > 0) { PrintFormat("LITUS: satu arah %s, %d pending lawan dihapus", nb > 0 ? "BUY" : "SELL", d); no = CountPend(pb, ps); }
   }
   if(np > 0) { EnsureEmergSL(); SyncSL(nb, ns); }
   string why = "";
   bool ok = FiltersOK(why);
   st_block = why;
   if(why != g_lastWhy)
   {  // v1.03: alasan menahan entry tercatat di log Experts (dulu hanya di panel)
      if(why == "") Print("LITUS: filter OK, entry aktif");
      else PrintFormat("LITUS: tahan entry baru: %s (%s | %s | spread %s)", why, st_vol, st_time, st_spread);
      g_lastWhy = why;
   }

   if(np > 0)
   {
      st_state = "BASKET AKTIF";
      if(TimeCurrent() >= g_closedUntil) ManageBasket(profit);
   }
   else
   {
      if(g_hadPos)
      {  // basket berakhir di luar EA (SL server / manual / stop out) -> bersihkan
         double cpl = ClosedPL(g_basketStart);
         PrintFormat("LITUS: tutup basket (SL server/manual) P/L %.2f puncak %.2f", cpl, g_peak);
         g_lastClose = StringFormat("%s SL %.2f", TimeToString(TimeCurrent(), TIME_MINUTES), cpl);
         if(no > 0) DeletePend();
         g_hadPos = false; g_peak = 0; g_lockOn = false; g_basketStart = 0;
         GlobalVariableDel(g_gvPeak); GlobalVariableDel(g_gvStart);
         g_cooldown = TimeCurrent() + InpCooldownSec;
         if(InpLossCooldownSec > 0 && cpl < 0) g_cooldown = TimeCurrent() + InpLossCooldownSec;
         no = CountPend(pb, ps);
      }
      st_be = InpUseBE ? "ON" : "OFF"; st_trail = InpUseTrail ? "ON" : "OFF";
      if(!ok)
      {
         st_state = "MENUNGGU: " + why;
         if(no > 0 && InpDeleteBlocked && why != "Algo Trading mati" && why != "belum terhubung") DeletePend();
      }
      else if(no == 0)
      {
         if(TimeCurrent() >= g_cooldown) { st_state = "SCANNING"; PlaceGrid(); }
         else st_state = "JEDA";
      }
      else st_state = "TANGGA TERPASANG";
   }
   if(InpShowPanel) Panel(profit, lb, ls, nb, ns, pb, ps);
}

//+------------------------------------------------------------------+
#define PFX "LITUS_P_"
void Lbl(int row, string txt, color c, int size = 9, string font = "Consolas")
{
   string nm = PFX + IntegerToString(row);
   if(ObjectFind(0, nm) < 0)
   {
      ObjectCreate(0, nm, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, nm, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, nm, OBJPROP_XDISTANCE, 18);
      ObjectSetInteger(0, nm, OBJPROP_YDISTANCE, 28 + row * 17);
      ObjectSetInteger(0, nm, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, nm, OBJPROP_HIDDEN, true);
   }
   ObjectSetString(0, nm, OBJPROP_TEXT, txt);
   ObjectSetString(0, nm, OBJPROP_FONT, font);
   ObjectSetInteger(0, nm, OBJPROP_FONTSIZE, size);
   ObjectSetInteger(0, nm, OBJPROP_COLOR, c);
}

void Panel(double profit, double lb, double ls, int nb, int ns, int pb, int ps)
{
   string bg = PFX + "bg";
   if(ObjectFind(0, bg) < 0)
   {
      ObjectCreate(0, bg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, bg, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, bg, OBJPROP_XDISTANCE, 8);
      ObjectSetInteger(0, bg, OBJPROP_YDISTANCE, 20);
      ObjectSetInteger(0, bg, OBJPROP_XSIZE, 360);
      ObjectSetInteger(0, bg, OBJPROP_YSIZE, 21 * 17 + 14);
      ObjectSetInteger(0, bg, OBJPROP_BGCOLOR, C'18,22,30');
      ObjectSetInteger(0, bg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(0, bg, OBJPROP_COLOR, C'255,176,32');
      ObjectSetInteger(0, bg, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, bg, OBJPROP_HIDDEN, true);
   }
   color ok = C'110,231,183', warn = C'251,191,36', bad = C'248,113,113', txt = C'226,232,240', gold = C'255,176,32';
   string cur = AccountInfoString(ACCOUNT_CURRENCY);
   int r = 0;
   Lbl(r++, "LITUS  v1.04   " + g_sym, gold, 11, "Arial Black");
   Lbl(r++, "● " + st_state, StringFind(st_state, "MENUNGGU") == 0 || st_state == "MARGIN KURANG" ? warn : ok, 9);
   Lbl(r++, "> Auto Entry: " + (st_block == "" ? "ON" : "TAHAN (" + st_block + ")"), st_block == "" ? ok : warn);
   Lbl(r++, "> News Filter: " + st_news, StringFind(st_news, "BLOK") == 0 ? bad : ok);
   Lbl(r++, "> Time Filter: " + st_time, StringFind(st_time, " ") > 0 && StringFind(st_time, "TUTUP") < 0 && StringFind(st_time, "JUMAT") < 0 && StringFind(st_time, "LIBUR") < 0 ? ok : (st_time == "OFF" ? txt : warn));
   Lbl(r++, "> Spread Check: " + st_spread, StringFind(st_spread, "OK") == 0 ? ok : bad);
   Lbl(r++, StringFormat("> Smart Lot Sizing: %s dasar %.2f", InpSmartLot ? "ON" : "OFF", BaseLot()), txt);
   Lbl(r++, StringFormat("> Risk Guard: ENABLED (basket %.0f%%, hari %.0f%%)", InpMaxBasketLossPct, InpMaxDailyLossPct), g_dayStop ? bad : ok);
   Lbl(r++, "> Auto Break-Even: " + st_be, st_be == "LOCKED" ? gold : ok);
   Lbl(r++, "> Trailing Stop: " + st_trail, st_trail == "AKTIF" ? gold : ok);
   Lbl(r++, "> Volatility Check: " + st_vol, StringFind(st_vol, "OK") == 0 ? ok : warn);
   Lbl(r++, "> Session Scanner: " + (st_block == "" ? "LIVE" : "PAUSE"), st_block == "" ? ok : warn);
   Lbl(r++, StringFormat("> Satu Arah: %s  SL %.1f step%s", InpOneWay ? "ON" : "OFF", InpSLSteps, InpSLFollowLock ? " + ikut kunci" : ""), InpOneWay ? ok : warn);
   Lbl(r++, StringFormat("Posisi  BUY %d (%.2f lot)  SELL %d (%.2f lot)", nb, lb, ns, ls), txt);
   Lbl(r++, StringFormat("Pending BUY STOP %d  SELL STOP %d", pb, ps), txt);
   Lbl(r++, StringFormat("Basket P/L %s %s", DoubleToString(profit, 2), cur), profit >= 0 ? ok : bad);
   Lbl(r++, StringFormat("Puncak %s   Kunci %s", DoubleToString(g_peak, 2), g_lockOn ? DoubleToString(g_lock, 2) : "-"), txt);
   Lbl(r++, StringFormat("Hari ini %s %s%s", DoubleToString(g_dayPL, 2), cur, g_dayStop ? "  STOP" : ""), g_dayPL >= 0 ? ok : bad);
   Lbl(r++, "Terakhir: " + g_lastClose, txt, 8);
   Lbl(r++, StringFormat("%s · tangga %d lvl x %.2f  lot %.2f..%.2f", g_preset, P_Levels, P_Step, LotAt(0, BaseLot()), LotAt(P_Levels - 1, BaseLot())), txt, 8);
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
int OnInit()
{
   g_sym = _Symbol;
   // v1.01: saat MT5 belum login/terhubung, margin mode terbaca 0 (netting) -> jangan gagal di sini,
   // NettingBlock() di Process() yang menahan trading sampai akun terbaca benar
   if(AccountInfoInteger(ACCOUNT_LOGIN) > 0 && TerminalInfoInteger(TERMINAL_CONNECTED) &&
      AccountInfoInteger(ACCOUNT_MARGIN_MODE) != ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
   {
      Alert("LITUS butuh akun HEDGING (BUY STOP & SELL STOP terbuka bersamaan). Akun ini netting.");
      return INIT_FAILED;
   }
   ResolvePreset();
   if(P_Step <= 0 || P_Levels < 1) { Alert("LITUS: P_Step/InpLevels tidak valid"); return INIT_PARAMETERS_INCORRECT; }
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpSlippage);
   trade.SetTypeFillingBySymbol(g_sym);
   trade.SetMarginMode();
   g_atr = InpUseATR ? iATR(g_sym, InpATRTF, InpATRPeriod) : INVALID_HANDLE;
   g_ema = P_TrendEMA > 0 ? iMA(g_sym, InpTrendTF, P_TrendEMA, 0, MODE_EMA, PRICE_CLOSE) : INVALID_HANDLE;
   string key = StringFormat("LITUS_%I64d_%s_%I64u_", AccountInfoInteger(ACCOUNT_LOGIN), g_sym, InpMagic);
   g_gvPeak = key + "peak"; g_gvStart = key + "start";
   double pr, lb, ls; int nb, ns;
   if(CountPos(pr, lb, ls, nb, ns) > 0)
   {  // lanjutkan basket yang sudah ada (restart MT5 / ganti input)
      g_hadPos = true;
      if(GlobalVariableCheck(g_gvPeak)) g_peak = MathMax(GlobalVariableGet(g_gvPeak), pr);
      else g_peak = MathMax(0, pr);
      g_basketStart = GlobalVariableCheck(g_gvStart) ? (datetime)GlobalVariableGet(g_gvStart) : TimeCurrent();
      PrintFormat("LITUS: melanjutkan basket %d posisi, P/L %.2f, puncak %.2f", nb + ns, pr, g_peak);
   }
   else
   {  // v1.01: tangga lama tanpa posisi dibangun ulang supaya input/Risk Guard terbaru berlaku
      int pb, ps;
      if(CountPend(pb, ps) > 0) { DeletePend(); Print("LITUS: tangga lama tanpa posisi dihapus, dipasang ulang"); }
   }
   g_day = -1;
   EventSetTimer(1);
   PrintFormat("LITUS v1.04 %s [%s]: %d level x %.2f, start %.2f, lot %.2f x%.1f tiap %d level (maks %.2f), satu arah %s SL %.1f step, EMA tren %d",
               g_sym, g_preset, P_Levels, P_Step, P_Start, InpBaseLot, InpLotMult, InpLotRepeat, InpMaxLot, InpOneWay ? "ON" : "OFF", InpSLSteps, P_TrendEMA);
   Process();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   if(g_atr != INVALID_HANDLE) IndicatorRelease(g_atr);
   if(g_ema != INVALID_HANDLE) IndicatorRelease(g_ema);
   ObjectsDeleteAll(0, PFX);
   // EA dilepas dari chart: jangan tinggalkan tangga pending tanpa pengelola
   if(reason == REASON_REMOVE || reason == REASON_CHARTCLOSE)
   {
      DeletePend();
      Print("LITUS dilepas: semua pending LITUS dihapus (posisi terbuka dibiarkan)");
   }
}

// v1.04: kriteria optimasi = recovery factor (profit / DD equity), basket sedikit dipenalti
double OnTester()
{
   double pr = TesterStatistics(STAT_PROFIT), dd = TesterStatistics(STAT_EQUITY_DD), tr = TesterStatistics(STAT_TRADES);
   double rf = pr / MathMax(dd, 1.0);
   if(tr < 30) rf = MathMin(rf, 0) - 1;
   return rf;
}

void OnTick()  { Process(); }
void OnTimer() { Process(); }
//+------------------------------------------------------------------+
