//+------------------------------------------------------------------+
//| IX_Sync_EA v2.04 (MT4)                                           |
//| Copyright © IX Live Trading Room | IX LTR                        |
//+------------------------------------------------------------------+
//|  - Pushes account & open orders every 8s                         |
//|  - Polls dashboard every 5s for "Take This Signal" orders        |
//|  - Executes received orders automatically                        |
//|  - Auto-translates web symbols (BTC/USDT -> BTCUSD, etc.)        |
//+------------------------------------------------------------------+
#property copyright "IX Live Trading Room | IX LTR"
#property version   "2.04"
#property strict

input string WebhookURL          = "{{WEBHOOK_URL}}";   // Pre-filled when downloaded from your dashboard
input string SecretToken         = "{{SECRET_TOKEN}}";  // Pre-filled when downloaded from your dashboard
input int    SendIntervalSeconds = 8;                   // Account/positions push interval
input int    PollIntervalSeconds = 5;                   // Pending orders poll interval
input int    MagicNumber         = 88008800;            // Identifies trades placed by this EA
input int    MaxSlippagePoints   = 30;                  // Max acceptable slippage for market orders

datetime lastSend = 0;
datetime lastPoll = 0;

//+------------------------------------------------------------------+
//| Automatic symbol translator (web -> broker)                      |
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
   return s;
}

//+------------------------------------------------------------------+
int OnInit()
{
   PrintFormat("✅ IX_Sync_EA v2.04 (MT4) | IX LTR loaded. Webhook: %s", WebhookURL);
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
   string json = StringFormat("{\"type\":\"account\",\"token\":\"%s\",\"platform\":\"mt4\",\"account\":%d,\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,\"free_margin\":%.2f,\"timestamp\":%d}",
                   SecretToken,
                  (int)AccountNumber(),
                  AccountBalance(),
                  AccountEquity(),
                  AccountMargin(),
                  AccountFreeMargin(),
                  (int)TimeCurrent());
   string resp; PostToWebhook(json, resp);
}

//+------------------------------------------------------------------+
void SendOpenPositions()
{
   string positions = "[";
   int total = OrdersTotal();
   bool first = true;
   for(int i = 0; i < total; i++)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderType() > OP_SELL) continue; // skip pending orders

      if(!first) positions += ",";
      first = false;
      positions += StringFormat("{\"ticket\":%d,\"symbol\":\"%s\",\"type\":%d,\"volume\":%.2f,\"entry\":%.5f,\"sl\":%.5f,\"tp\":%.5f,\"profit\":%.2f}",
         OrderTicket(),
         OrderSymbol(),
         OrderType(),
         OrderLots(),
         OrderOpenPrice(),
         OrderStopLoss(),
         OrderTakeProfit(),
         OrderProfit());
   }
   positions += "]";

   string json = StringFormat("{\"type\":\"positions\",\"token\":\"%s\",\"platform\":\"mt4\",\"account\":%d,\"positions\":%s}",
                   SecretToken, (int)AccountNumber(), positions);
   string resp; PostToWebhook(json, resp);
}

//+------------------------------------------------------------------+
//| Ask the dashboard for any pending "Take This Signal" orders.      |
//+------------------------------------------------------------------+
void PollPendingOrders()
{
   string body = StringFormat("{\"type\":\"poll_orders\",\"token\":\"%s\",\"platform\":\"mt4\",\"account\":%d}",
                              SecretToken, (int)AccountNumber());
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
   while(start < StringLen(src) && StringGetChar(src, start) == ' ') start++;
   if(StringSubstr(src, start, 4) == "null") return 0.0;
   int end = start;
   while(end < StringLen(src))
   {
      int c = StringGetChar(src, end);
      if((c >= '0' && c <= '9') || c == '.' || c == '-' || c == '+' || c == 'e' || c == 'E')
         end++;
      else break;
   }
   string num = StringSubstr(src, start, end - start);
   return StrToDouble(num);
}

//+------------------------------------------------------------------+
void ProcessOrder(const string obj)
{
   string id        = ExtractString(obj, "id");
   string rawSymbol = ExtractString(obj, "symbol");
   string symbol    = NormalizeSymbol(rawSymbol);
   string side      = ExtractString(obj, "side");
   string otype     = ExtractString(obj, "order_type");
   double vol       = ExtractNumber(obj, "volume");
   double entry     = ExtractNumber(obj, "entry_price");
   double sl        = ExtractNumber(obj, "stop_loss");
   double tp        = ExtractNumber(obj, "take_profit");

   if(StringLen(id) == 0 || StringLen(symbol) == 0 || vol <= 0)
   {
      ReportResult(id, "failed", 0, "Invalid order payload");
      return;
   }

   // Ensure symbol exists in Market Watch
   if(MarketInfo(symbol, MODE_BID) == 0)
   {
      ReportResult(id, "failed", 0, "Symbol not available: " + symbol);
      return;
   }

   bool isBuy = (side == "buy");
   int  ticket = -1;
   // Neutral comment - no platform reference
   string comment = "Signal-" + id;
   color clr = isBuy ? clrDodgerBlue : clrTomato;

   if(otype == "limit" && entry > 0)
   {
      int op = isBuy ? OP_BUYLIMIT : OP_SELLLIMIT;
      ticket = OrderSend(symbol, op, vol, entry, MaxSlippagePoints, sl, tp,
                         comment, MagicNumber, 0, clr);
   }
   else
   {
      double price = isBuy ? MarketInfo(symbol, MODE_ASK)
                           : MarketInfo(symbol, MODE_BID);
      int op = isBuy ? OP_BUY : OP_SELL;
      ticket = OrderSend(symbol, op, vol, price, MaxSlippagePoints, sl, tp,
                         comment, MagicNumber, 0, clr);
   }

   if(ticket > 0)
   {
      PrintFormat("✅ IX order %s placed. Ticket=%d", id, ticket);
      ReportResult(id, "executed", ticket, "OK");
   }
   else
   {
      int err = GetLastError();
      string msg = StringFormat("error=%d", err);
      PrintFormat("❌ IX order %s failed: %s", id, msg);
      ReportResult(id, "failed", 0, msg);
   }
}

//+------------------------------------------------------------------+
void ReportResult(string orderId, string status, int ticket, string message)
{
   if(StringLen(orderId) == 0) return;
   string safeMsg = message;
   StringReplace(safeMsg, "\\", "\\\\");
   StringReplace(safeMsg, "\"", "\\\"");
   string body = StringFormat("{\"type\":\"order_result\",\"token\":\"%s\",\"order_id\":\"%s\",\"status\":\"%s\",\"ticket\":\"%d\",\"message\":\"%s\"}",
                               SecretToken, orderId, status, ticket, safeMsg);
   string resp; PostToWebhook(body, resp);
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
