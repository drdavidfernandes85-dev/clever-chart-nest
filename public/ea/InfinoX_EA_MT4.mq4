//+------------------------------------------------------------------+
//| InfinoX_EA_MT4 v2.00                                             |
//| - Pushes account & open positions every 8s                       |
//| - Polls dashboard every 5s for "Take This Signal" orders         |
//| - Executes received orders automatically                         |
//+------------------------------------------------------------------+
#property copyright "InfinoX Elite Live Trading Room"
#property version   "2.00"
#property strict

extern string WebhookURL          = "{{WEBHOOK_URL}}";   // Pre-filled when downloaded from your dashboard
extern string SecretToken         = "{{SECRET_TOKEN}}";  // Pre-filled when downloaded from your dashboard
extern int    SendIntervalSeconds = 8;
extern int    PollIntervalSeconds = 5;
extern int    MagicNumber         = 88008800;
extern int    MaxSlippagePoints   = 30;

datetime lastSend = 0;
datetime lastPoll = 0;

int OnInit()
{
   Print("InfinoX EA (MT4) v2.00 started. Webhook: ", WebhookURL);
   if(StringLen(SecretToken) < 16)
      Print("WARNING: SecretToken looks empty/short. Re-download EA from your dashboard.");
   return(INIT_SUCCEEDED);
}

string EscapeJson(string s)
{
   string r = s;
   StringReplace(r, "\\", "\\\\");
   StringReplace(r, "\"", "\\\"");
   return r;
}

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

void SendAccountInfo()
{
   int    login   = (int)AccountNumber();
   double balance = AccountBalance();
   double equity  = AccountEquity();
   double margin  = AccountMargin();
   double freeM   = AccountFreeMargin();
   string curr    = AccountCurrency();
   int    lev     = (int)AccountLeverage();
   string broker  = EscapeJson(AccountCompany());
   string server  = EscapeJson(AccountServer());

   string json = StringFormat(
      "{\"type\":\"account\",\"platform\":\"mt4\",\"account\":%d,\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,\"free_margin\":%.2f,\"currency\":\"%s\",\"leverage\":%d,\"broker\":\"%s\",\"server\":\"%s\",\"timestamp\":%d}",
      login, balance, equity, margin, freeM, curr, lev, broker, server, (int)TimeCurrent()
   );
   string resp; PostToWebhook(json, resp);
}

void SendOpenPositions()
{
   string positions = "[";
   int total = OrdersTotal();
   bool first = true;
   for(int i = 0; i < total; i++)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      int t = OrderType();
      if(t != OP_BUY && t != OP_SELL) continue;

      if(!first) positions += ",";
      first = false;

      positions += StringFormat(
         "{\"ticket\":%d,\"symbol\":\"%s\",\"type\":%d,\"volume\":%.2f,\"entry\":%.5f,\"sl\":%.5f,\"tp\":%.5f,\"profit\":%.2f,\"time\":%d}",
         OrderTicket(), OrderSymbol(), t, OrderLots(),
         OrderOpenPrice(), OrderStopLoss(), OrderTakeProfit(),
         OrderProfit() + OrderSwap() + OrderCommission(),
         (int)OrderOpenTime()
      );
   }
   positions += "]";

   int login = (int)AccountNumber();
   string json = StringFormat(
      "{\"type\":\"positions\",\"platform\":\"mt4\",\"account\":%d,\"positions\":%s}",
      login, positions
   );
   string resp; PostToWebhook(json, resp);
}

//+------------------------------------------------------------------+
//| Poll dashboard for pending orders to execute.                    |
//+------------------------------------------------------------------+
void PollPendingOrders()
{
   int login = (int)AccountNumber();
   string body = StringFormat("{\"type\":\"poll_orders\",\"platform\":\"mt4\",\"account\":%d}", login);
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
   return StrToDouble(StringSubstr(src, start, end - start));
}

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

   bool isBuy = (side == "buy");
   int  cmd   = isBuy ? OP_BUY : OP_SELL;
   double price = isBuy ? MarketInfo(symbol, MODE_ASK) : MarketInfo(symbol, MODE_BID);

   int ticket = -1;
   if(otype == "limit" && entry > 0)
   {
      cmd = isBuy ? OP_BUYLIMIT : OP_SELLLIMIT;
      ticket = OrderSend(symbol, cmd, vol, entry, MaxSlippagePoints, sl, tp,
                         "InfinoX " + id, MagicNumber, 0, isBuy ? clrLime : clrRed);
   }
   else
   {
      ticket = OrderSend(symbol, cmd, vol, price, MaxSlippagePoints, sl, tp,
                         "InfinoX " + id, MagicNumber, 0, isBuy ? clrLime : clrRed);
   }

   if(ticket > 0)
   {
      Print("✅ InfinoX order ", id, " placed. Ticket=", ticket);
      ReportResult(id, "executed", ticket, "OK");
   }
   else
   {
      int err = GetLastError();
      string msg = StringFormat("err=%d", err);
      Print("❌ InfinoX order ", id, " failed: ", msg);
      ReportResult(id, "failed", 0, msg);
   }
}

void ReportResult(string orderId, string status, int ticket, string message)
{
   if(StringLen(orderId) == 0) return;
   string body = StringFormat(
      "{\"type\":\"order_result\",\"order_id\":\"%s\",\"status\":\"%s\",\"ticket\":\"%d\",\"message\":\"%s\"}",
      orderId, status, ticket, EscapeJson(message)
   );
   string resp; PostToWebhook(body, resp);
}

int PostToWebhook(string body, string &response)
{
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + SecretToken + "\r\n";
   char data[]; char result[];
   StringToCharArray(body, data, 0, StringLen(body), CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1);

   string responseHeaders;
   ResetLastError();
   int code = WebRequest("POST", WebhookURL, headers, 15000, data, result, responseHeaders);

   if(code == -1)
   {
      Print("WebRequest failed. Error ", GetLastError(),
            " — add ", WebhookURL, " to Tools > Options > Expert Advisors > Allow WebRequest.");
      response = "";
      return -1;
   }
   response = CharArrayToString(result);
   if(code != 200) Print("Webhook HTTP ", code, ": ", response);
   return code;
}
