//+------------------------------------------------------------------+
//| InfinoX_EA_MT4_to_Lovable.mq4                                    |
//| Sends account & open positions to your Elite Live Trading Room   |
//| Lovable Cloud webhook every 8 seconds.                           |
//+------------------------------------------------------------------+
#property copyright "InfinoX Elite Live Trading Room"
#property version   "1.00"
#property strict

extern string WebhookURL  = "{{WEBHOOK_URL}}";  // Pre-filled when downloaded from your dashboard
extern string SecretToken = "{{SECRET_TOKEN}}"; // Pre-filled when downloaded from your dashboard
extern int    SendIntervalSeconds = 8;

datetime lastSend = 0;

int OnInit()
{
   Print("InfinoX EA (MT4) started. Webhook: ", WebhookURL);
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
   if(TimeCurrent() - lastSend < SendIntervalSeconds) return;
   lastSend = TimeCurrent();
   SendAccountInfo();
   SendOpenPositions();
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
   PostToWebhook(json);
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
      if(t != OP_BUY && t != OP_SELL) continue; // skip pending

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
   PostToWebhook(json);
}

void PostToWebhook(string body)
{
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + SecretToken + "\r\n";
   char data[]; char result[];
   StringToCharArray(body, data, 0, StringLen(body), CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1);

   string responseHeaders;
   ResetLastError();
   int code = WebRequest("POST", WebhookURL, headers, 15000, data, result, responseHeaders);

   if(code == -1)
      Print("WebRequest failed. Error ", GetLastError(),
            " — add ", WebhookURL, " to Tools > Options > Expert Advisors > Allow WebRequest.");
   else if(code == 200)
      Print("InfinoX sync OK");
   else
      Print("Webhook HTTP ", code, ": ", CharArrayToString(result));
}
