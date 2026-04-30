//+------------------------------------------------------------------+
//| IX_Sync_EA v2.05 (MT5)                                           |
//| Copyright © IX Live Trading Room | IX LTR                        |
//+------------------------------------------------------------------+
#property copyright "IX Live Trading Room | IX LTR"
#property version   "2.05"
#property strict

#include <Trade/Trade.mqh>

input string WebhookURL          = "{{WEBHOOK_URL}}";   // Pre-filled when downloaded from your dashboard
input string SecretToken         = "{{SECRET_TOKEN}}";  // Pre-filled when downloaded from your dashboard
input int    SendIntervalSeconds = 8;
input int    PollIntervalSeconds = 5;
input int    HistoryIntervalSeconds = 30;   // How often to push closed-deal history
input int    HistoryLookbackDays = 30;      // How far back to scan history on start
input int    MagicNumber         = 88008800;
input int    MaxSlippagePoints   = 30;

CTrade trade;
datetime lastSend = 0;
datetime lastPoll = 0;
datetime lastHistorySend = 0;
datetime historyCursor = 0;   // Only send deals with time > cursor

//+------------------------------------------------------------------+
//| Traductor automático de símbolos                                 |
//+------------------------------------------------------------------+
string NormalizeSymbol(string webSymbol)
{
   if(webSymbol == "") return "";

   string s = webSymbol;
   StringReplace(s, "/", "");
   StringReplace(s, "-", "");
   StringReplace(s, "USDT", "USD");
   StringReplace(s, "USDC", "USD");
   StringReplace(s, "USDt", "USD");

   if(s == "BTCUSD")   return "BTCUSD";
   if(s == "ETHUSD")   return "ETHUSD";
   if(s == "SOLUSD")   return "SOLUSD";
   if(s == "XRPUSD")   return "XRPUSD";
   if(s == "XAUUSD")   return "XAUUSD";
   if(s == "EURUSD")   return "EURUSD";
   if(s == "GBPUSD")   return "GBPUSD";
   if(s == "AUDUSD")   return "AUDUSD";
   if(s == "USDJPY")   return "USDJPY";
   if(s == "NZDUSD")   return "NZDUSD";
   if(s == "USDCAD")   return "USDCAD";
   if(s == "EURJPY")   return "EURJPY";
   return s;
}

//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(MaxSlippagePoints);

   Print("✅ IX_Sync_EA v2.05 (MT5) cargado correctamente");
   Print("   Webhook URL: ", WebhookURL);

   if(StringLen(SecretToken) < 20)
      Print("⚠️ AVISO: SecretToken parece incompleto.");

   // Initialize history cursor: start from N days ago so we backfill recent history once.
   historyCursor = TimeCurrent() - (datetime)(HistoryLookbackDays * 86400);

   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   Print("IX_Sync_EA v2.05 detenido.");
}

//+------------------------------------------------------------------+
void OnTick()
{
   datetime now = TimeCurrent();

   if(now - lastSend >= SendIntervalSeconds)
   {
      lastSend = now;
      SendAccountInfo();
      SendOpenPositions();
   }

   if(now - lastPoll >= PollIntervalSeconds)
   {
      lastPoll = now;
      PollPendingOrders();
   }

   if(now - lastHistorySend >= HistoryIntervalSeconds)
   {
      lastHistorySend = now;
      SendClosedDeals();
   }
}

//+------------------------------------------------------------------+
void SendAccountInfo()
{
   string json = StringFormat("{\"type\":\"account\",\"token\":\"%s\",\"platform\":\"mt5\",\"account\":%I64d,\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,\"free_margin\":%.2f,\"timestamp\":%d}",
                   SecretToken,
                  AccountInfoInteger(ACCOUNT_LOGIN),
                  AccountInfoDouble(ACCOUNT_BALANCE),
                  AccountInfoDouble(ACCOUNT_EQUITY),
                  AccountInfoDouble(ACCOUNT_MARGIN),
                  AccountInfoDouble(ACCOUNT_MARGIN_FREE),
                  TimeCurrent());

   string resp;
   PostToWebhook(json, resp);
}

//+------------------------------------------------------------------+
void SendOpenPositions()
{
   string positions = "[";
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      if(i > 0) positions += ",";
      ulong ticket = PositionGetTicket(i);
      positions += StringFormat("{\"ticket\":%d,\"symbol\":\"%s\",\"type\":%d,\"volume\":%.2f,\"entry\":%.5f,\"sl\":%.5f,\"tp\":%.5f,\"profit\":%.2f}",
         ticket,
         PositionGetString(POSITION_SYMBOL),
         (int)PositionGetInteger(POSITION_TYPE),
         PositionGetDouble(POSITION_VOLUME),
         PositionGetDouble(POSITION_PRICE_OPEN),
         PositionGetDouble(POSITION_SL),
         PositionGetDouble(POSITION_TP),
         PositionGetDouble(POSITION_PROFIT));
   }
   positions += "]";

   string json = StringFormat("{\"type\":\"positions\",\"token\":\"%s\",\"platform\":\"mt5\",\"account\":%I64d,\"positions\":%s}",
                   SecretToken, AccountInfoInteger(ACCOUNT_LOGIN), positions);
   string resp;
   PostToWebhook(json, resp);
}

//+------------------------------------------------------------------+
void PollPendingOrders()
{
   string body = StringFormat("{\"type\":\"poll_orders\",\"token\":\"%s\",\"platform\":\"mt5\",\"account\":%I64d}",
                              SecretToken, AccountInfoInteger(ACCOUNT_LOGIN));
   string resp;
   int code = PostToWebhook(body, resp);
   if(code != 200) return;

   int idx = StringFind(resp, "\"orders\"");
   if(idx < 0) return;
   int arrStart = StringFind(resp, "[", idx);
   if(arrStart < 0) return;

   int searchFrom = arrStart + 1;
   while(true)
   {
      int objStart = StringFind(resp, "{", searchFrom);
      if(objStart < 0) break;
      int objEnd = StringFind(resp, "}", objStart);
      if(objEnd < 0) break;

      string obj = StringSubstr(resp, objStart, objEnd - objStart + 1);
      ProcessOrder(obj);
      searchFrom = objEnd + 1;
   }
}

//+------------------------------------------------------------------+
void ProcessOrder(const string obj)
{
   string id     = ExtractString(obj, "id");
   string symbol = ExtractString(obj, "symbol");
   string side   = ExtractString(obj, "side");
   string otype  = ExtractString(obj, "order_type");
   double vol    = ExtractNumber(obj, "volume");
   double entry  = ExtractNumber(obj, "entry_price");
   double sl     = ExtractNumber(obj, "stop_loss");
   double tp     = ExtractNumber(obj, "take_profit");

   if(StringLen(id) == 0 || StringLen(symbol) == 0 || vol <= 0)
   {
      ReportResult(id, "failed", 0, "Invalid order payload");
      return;
   }

   string mt5Symbol = NormalizeSymbol(symbol);
   if(!SymbolSelect(mt5Symbol, true))
   {
      ReportResult(id, "failed", 0, "Symbol not available: " + mt5Symbol);
      return;
   }

   bool isBuy = (side == "buy");
   bool ok = false;
   string err = "";

   double price = isBuy ? SymbolInfoDouble(mt5Symbol, SYMBOL_ASK) : SymbolInfoDouble(mt5Symbol, SYMBOL_BID);

   // Neutral comment - no platform reference
   string comment = "Signal-" + id;

   if(otype == "limit" && entry > 0)
   {
      ENUM_ORDER_TYPE ot = isBuy ? ORDER_TYPE_BUY_LIMIT : ORDER_TYPE_SELL_LIMIT;
      ok = trade.OrderOpen(mt5Symbol, ot, vol, 0, entry, sl, tp, ORDER_TIME_GTC, 0, comment);
   }
   else
   {
      ok = isBuy ? trade.Buy(vol, mt5Symbol, price, sl, tp, comment)
                 : trade.Sell(vol, mt5Symbol, price, sl, tp, comment);
   }

   if(ok)
   {
      ulong ticket = trade.ResultOrder();
      PrintFormat("✅ ORDER EXECUTED | ID: %s | %s %s | Ticket: %I64u | Comment: %s", id, isBuy?"BUY":"SELL", mt5Symbol, ticket, comment);
      ReportResult(id, "executed", (long)ticket, "OK");
   }
   else
   {
      err = StringFormat("retcode=%u %s", trade.ResultRetcode(), trade.ResultComment());
      PrintFormat("❌ ORDER FAILED | ID: %s | Error: %s", id, err);
      ReportResult(id, "failed", 0, err);
   }
}

//+------------------------------------------------------------------+
string ExtractString(const string src, const string key)
{
   string pat = "\"" + key + "\"";
   int k = StringFind(src, pat);
   if(k < 0) return "";
   int colon = StringFind(src, ":", k);
   if(colon < 0) return "";
   int q1 = StringFind(src, "\"", colon + 1);
   if(q1 < 0) return "";
   int q2 = StringFind(src, "\"", q1 + 1);
   if(q2 < 0) return "";
   return StringSubstr(src, q1 + 1, q2 - q1 - 1);
}

double ExtractNumber(const string src, const string key)
{
   string pat = "\"" + key + "\"";
   int k = StringFind(src, pat);
   if(k < 0) return 0.0;
   int colon = StringFind(src, ":", k);
   if(colon < 0) return 0.0;
   int start = colon + 1;
   while(start < StringLen(src) && StringGetCharacter(src, start) == ' ') start++;
   if(StringSubstr(src, start, 4) == "null") return 0.0;

   int end = start;
   while(end < StringLen(src))
   {
      ushort c = StringGetCharacter(src, end);
      if((c >= '0' && c <= '9') || c == '.' || c == '-' || c == '+' || c == 'e' || c == 'E')
         end++;
      else break;
   }
   string num = StringSubstr(src, start, end - start);
   return StringToDouble(num);
}

//+------------------------------------------------------------------+
void ReportResult(string orderId, string status, long ticket, string message)
{
   if(StringLen(orderId) == 0) return;
   string safeMsg = message;
   StringReplace(safeMsg, "\\", "\\\\");
   StringReplace(safeMsg, "\"", "\\\"");

   string body = StringFormat("{\"type\":\"order_result\",\"token\":\"%s\",\"order_id\":\"%s\",\"status\":\"%s\",\"ticket\":\"%I64d\",\"message\":\"%s\"}",
                               SecretToken, orderId, status, ticket, safeMsg);
   string resp;
   PostToWebhook(body, resp);
}

//+------------------------------------------------------------------+
int PostToWebhook(string body, string &response)
{
   char postData[];
   StringToCharArray(body, postData, 0, StringLen(body));
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + SecretToken + "\r\nX-Webhook-Token: " + SecretToken + "\r\n";

   char result[];
   string responseHeaders;
   ResetLastError();

   int res = WebRequest("POST", WebhookURL, headers, 30000, postData, result, responseHeaders);

   if(res == -1)
   {
      int err = GetLastError();
      PrintFormat("❌ WebRequest failed. Error %d — Añade %s en Herramientas > Opciones > Expert Advisors > Allow WebRequest.", err, WebhookURL);
      response = "";
      return -1;
   }

   response = CharArrayToString(result);
   if(res != 200)
      PrintFormat("⚠️ Webhook returned HTTP %d", res);

   return res;
}
//+------------------------------------------------------------------+
