//+------------------------------------------------------------------+
//|                     InfinoX_Sync_EA v2.00 (MT5)                  |
//|  - Pushes account & open positions every 8s                      |
//|  - Polls dashboard every 5s for "Take This Signal" orders        |
//|  - Executes received orders automatically                        |
//+------------------------------------------------------------------+
#property copyright "InfinoX Elite Live Trading Room"
#property version   "2.00"
#property strict

#include <Trade/Trade.mqh>

input string  WebhookURL          = "{{WEBHOOK_URL}}";   // Pre-filled when downloaded from your dashboard
input string  SecretToken         = "{{SECRET_TOKEN}}";  // Pre-filled when downloaded from your dashboard
input int     SendIntervalSeconds = 8;                   // Account/positions push interval
input int     PollIntervalSeconds = 5;                   // Pending orders poll interval
input int     MagicNumber         = 88008800;            // Identifies trades placed by this EA
input int     MaxSlippagePoints   = 30;                  // Max acceptable slippage for market orders

CTrade trade;
datetime lastSend = 0;
datetime lastPoll = 0;

//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(MaxSlippagePoints);
   PrintFormat("✅ InfinoX EA v2.00 (MT5) loaded. Webhook: %s", WebhookURL);
   if(StringLen(SecretToken) < 16)
      Print("⚠️ WARNING: SecretToken looks empty/short. Re-download EA from your dashboard.");
   return(INIT_SUCCEEDED);
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
}

//+------------------------------------------------------------------+
void SendAccountInfo()
{
   string json = StringFormat("{\"type\":\"account\",\"platform\":\"mt5\",\"account\":%I64d,\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,\"free_margin\":%.2f,\"timestamp\":%d}",
                  AccountInfoInteger(ACCOUNT_LOGIN),
                  AccountInfoDouble(ACCOUNT_BALANCE),
                  AccountInfoDouble(ACCOUNT_EQUITY),
                  AccountInfoDouble(ACCOUNT_MARGIN),
                  AccountInfoDouble(ACCOUNT_MARGIN_FREE),
                  TimeCurrent());
   string resp; PostToWebhook(json, resp);
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

   string json = StringFormat("{\"type\":\"positions\",\"platform\":\"mt5\",\"account\":%I64d,\"positions\":%s}",
                  AccountInfoInteger(ACCOUNT_LOGIN), positions);
   string resp; PostToWebhook(json, resp);
}

//+------------------------------------------------------------------+
//| Ask the dashboard for any pending "Take This Signal" orders.      |
//| If any are returned, execute them and report back.                |
//+------------------------------------------------------------------+
void PollPendingOrders()
{
   string body = StringFormat("{\"type\":\"poll_orders\",\"platform\":\"mt5\",\"account\":%I64d}",
                              AccountInfoInteger(ACCOUNT_LOGIN));
   string resp;
   int code = PostToWebhook(body, resp);
   if(code != 200) return;

   // Find the "orders":[ ... ] array.
   int idx = StringFind(resp, "\"orders\"");
   if(idx < 0) return;
   int arrStart = StringFind(resp, "[", idx);
   if(arrStart < 0) return;

   // Iterate through {} blocks inside the array.
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
//| Lightweight JSON helpers (good enough for our flat payloads).     |
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
   // skip spaces
   while(start < StringLen(src) && StringGetCharacter(src, start) == ' ') start++;
   // detect null
   if(StringSubstr(src, start, 4) == "null") return 0.0;
   // collect digits / . / -
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

   if(!SymbolSelect(symbol, true))
   {
      ReportResult(id, "failed", 0, "Symbol not available: " + symbol);
      return;
   }

   bool isBuy = (side == "buy");
   bool ok = false;
   string err = "";

   if(otype == "limit" && entry > 0)
   {
      ENUM_ORDER_TYPE ot = isBuy ? ORDER_TYPE_BUY_LIMIT : ORDER_TYPE_SELL_LIMIT;
      ok = trade.OrderOpen(symbol, ot, vol, 0, entry, sl, tp, ORDER_TIME_GTC, 0,
                           "InfinoX " + id);
   }
   else
   {
      double price = isBuy ? SymbolInfoDouble(symbol, SYMBOL_ASK)
                           : SymbolInfoDouble(symbol, SYMBOL_BID);
      ok = isBuy
         ? trade.Buy(vol, symbol, price, sl, tp, "InfinoX " + id)
         : trade.Sell(vol, symbol, price, sl, tp, "InfinoX " + id);
   }

   if(ok)
   {
      ulong ticket = trade.ResultOrder();
      PrintFormat("✅ InfinoX order %s placed. Ticket=%I64u", id, ticket);
      ReportResult(id, "executed", (long)ticket, "OK");
   }
   else
   {
      err = StringFormat("retcode=%u %s", trade.ResultRetcode(), trade.ResultComment());
      PrintFormat("❌ InfinoX order %s failed: %s", id, err);
      ReportResult(id, "failed", 0, err);
   }
}

//+------------------------------------------------------------------+
void ReportResult(string orderId, string status, long ticket, string message)
{
   if(StringLen(orderId) == 0) return;
   string safeMsg = message;
   StringReplace(safeMsg, "\\", "\\\\");
   StringReplace(safeMsg, "\"", "\\\"");
   string body = StringFormat("{\"type\":\"order_result\",\"order_id\":\"%s\",\"status\":\"%s\",\"ticket\":\"%I64d\",\"message\":\"%s\"}",
                              orderId, status, ticket, safeMsg);
   string resp; PostToWebhook(body, resp);
}

//+------------------------------------------------------------------+
int PostToWebhook(string body, string &response)
{
   char postData[];
   StringToCharArray(body, postData, 0, StringLen(body));

   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + SecretToken;
   char result[];
   string responseHeaders;

   ResetLastError();
   int res = WebRequest("POST", WebhookURL, headers, 30000, postData, result, responseHeaders);

   if(res == -1)
   {
      PrintFormat("❌ WebRequest failed. Error %d — add %s to Tools > Options > Expert Advisors > Allow WebRequest.",
                  GetLastError(), WebhookURL);
      response = "";
      return -1;
   }
   response = CharArrayToString(result);
   if(res != 200)
      PrintFormat("⚠️ Webhook HTTP %d: %s", res, response);
   return res;
}
