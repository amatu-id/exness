//+------------------------------------------------------------------+
//|                                                      MACross.mq5 |
//|  Contoh EA sederhana: EMA cepat memotong EMA lambat.             |
//|  Satu posisi per arah, SL/TP tetap dalam harga, trailing opsional|
//+------------------------------------------------------------------+
#property copyright   "Amatu"
#property version     "1.00"
#property description "EMA cross: buka BUY saat EMA cepat naik melewati EMA lambat, SELL sebaliknya."

#include <Trade/Trade.mqh>

input group "=== Sinyal ==="
input int             InpFast      = 9;          // EMA cepat
input int             InpSlow      = 21;         // EMA lambat
input ENUM_TIMEFRAMES InpTF        = PERIOD_CURRENT; // Timeframe sinyal
input group "=== Order ==="
input double          InpLot       = 0.01;       // Lot
input double          InpSL        = 5.0;        // Stop Loss (harga, 0 = tanpa)
input double          InpTP        = 10.0;       // Take Profit (harga, 0 = tanpa)
input double          InpTrail     = 0;          // Trailing stop (harga, 0 = off)
input bool            InpReverse   = true;       // Tutup posisi lawan saat sinyal berbalik
input ulong           InpMagic     = 909090;     // Magic number

CTrade   trade;
int      hFast = INVALID_HANDLE, hSlow = INVALID_HANDLE;
datetime lastBar = 0;

int OnInit()
{
   if(InpFast >= InpSlow) { Print("EMA cepat harus lebih kecil dari EMA lambat"); return INIT_PARAMETERS_INCORRECT; }
   hFast = iMA(_Symbol, InpTF, InpFast, 0, MODE_EMA, PRICE_CLOSE);
   hSlow = iMA(_Symbol, InpTF, InpSlow, 0, MODE_EMA, PRICE_CLOSE);
   if(hFast == INVALID_HANDLE || hSlow == INVALID_HANDLE) return INIT_FAILED;
   trade.SetExpertMagicNumber(InpMagic);
   PrintFormat("MA Cross siap: EMA %d / %d, lot %.2f, SL %.2f TP %.2f", InpFast, InpSlow, InpLot, InpSL, InpTP);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   IndicatorRelease(hFast);
   IndicatorRelease(hSlow);
}

int CountPos(ENUM_POSITION_TYPE type)
{
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol || PositionGetInteger(POSITION_MAGIC) != (long)InpMagic) continue;
      if(PositionGetInteger(POSITION_TYPE) == type) n++;
   }
   return n;
}

void CloseType(ENUM_POSITION_TYPE type)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol || PositionGetInteger(POSITION_MAGIC) != (long)InpMagic) continue;
      if(PositionGetInteger(POSITION_TYPE) == type) trade.PositionClose(t);
   }
}

void Trail()
{
   if(InpTrail <= 0) return;
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID), ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol || PositionGetInteger(POSITION_MAGIC) != (long)InpMagic) continue;
      double sl = PositionGetDouble(POSITION_SL), tp = PositionGetDouble(POSITION_TP), op = PositionGetDouble(POSITION_PRICE_OPEN);
      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
      {
         double nsl = NormalizeDouble(bid - InpTrail, _Digits);
         if(bid - op > InpTrail && (sl == 0 || nsl > sl + _Point)) trade.PositionModify(t, nsl, tp);
      }
      else
      {
         double nsl = NormalizeDouble(ask + InpTrail, _Digits);
         if(op - ask > InpTrail && (sl == 0 || nsl < sl - _Point)) trade.PositionModify(t, nsl, tp);
      }
   }
}

void OnTick()
{
   Trail();
   datetime bar = iTime(_Symbol, InpTF, 0);
   if(bar == 0 || bar == lastBar) return;          // satu keputusan per bar baru
   double f[], s[];
   ArraySetAsSeries(f, true);
   ArraySetAsSeries(s, true);
   if(CopyBuffer(hFast, 0, 1, 2, f) < 2 || CopyBuffer(hSlow, 0, 1, 2, s) < 2) return;
   lastBar = bar;
   bool up = f[1] <= s[1] && f[0] > s[0];        // potong ke atas di bar yang baru selesai
   bool dn = f[1] >= s[1] && f[0] < s[0];
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK), bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(up)
   {
      if(InpReverse) CloseType(POSITION_TYPE_SELL);
      if(CountPos(POSITION_TYPE_BUY) == 0)
         trade.Buy(InpLot, _Symbol, ask, InpSL > 0 ? NormalizeDouble(ask - InpSL, _Digits) : 0, InpTP > 0 ? NormalizeDouble(ask + InpTP, _Digits) : 0, "MA Cross");
   }
   else if(dn)
   {
      if(InpReverse) CloseType(POSITION_TYPE_BUY);
      if(CountPos(POSITION_TYPE_SELL) == 0)
         trade.Sell(InpLot, _Symbol, bid, InpSL > 0 ? NormalizeDouble(bid + InpSL, _Digits) : 0, InpTP > 0 ? NormalizeDouble(bid - InpTP, _Digits) : 0, "MA Cross");
   }
}
//+------------------------------------------------------------------+
