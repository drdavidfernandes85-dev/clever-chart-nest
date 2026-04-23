//+------------------------------------------------------------------+
//| InfinoX_EA_MT5_to_Lovable.mq5                                    |
//| Sends account & open positions to your Elite Live Trading Room   |
//| Lovable Cloud webhook every 8 seconds.                           |
//+------------------------------------------------------------------+
#property copyright "InfinoX Elite Live Trading Room"
#property version   "1.00"
#property strict

input string WebhookURL  = "{{WEBHOOK_URL}}";  // Pre-filled when downloaded from your dashboard
input string SecretToken = "{{SECRET_TOKEN}}"; // Pre-filled when downloaded from your dashboard
input int    SendIntervalSeconds = 8;

datetime lastSend = 0;

int OnInit()
{
   Print("InfinoX EA started. Webhook: ", WebhookURL);
   if(StringLen(SecretToken) < 16)
      Print("WARNING: SecretToken looks empty/short. Re-download EA from your dashboard.");
   return(INIT_SUCCEEDED);
}

void OnTick()
{
   if(TimeCurrent() - lastSend < SendIntervalSeconds) return;
   lastSend = TimeCurrent();
   SendAccountInfo();
   SendOpenPositions();
}

string EscapeJson(string s)
{
   string r = s;
   StringReplace(r, "\\", "\\\\");
   StringReplace(r, "\"", "\\\"");
   return r;
}

void SendAccountInfo()
{
   long   login   = AccountInfoInteger(ACCOUNT_LOGIN);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin  = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeM   = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   string curr    = AccountInfoString(ACCOUNT_CURRENCY);
   long   lev     = AccountInfoInteger(ACCOUNT_LEVERAGE);
   string broker  = EscapeJson(AccountInfoString(ACCOUNT_COMPANY));
   string server  = EscapeJson(AccountInfoString(ACCOUNT_SERVER));

   string json = StringFormat(
      "{\"type\":\"account\",\"platform\":\"mt5\",\"account\":%I64d,\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,\"free_margin\":%.2f,\"currency\":\"%s\",\"leverage\":%I64d,\"broker\":\"%s\",\"server\":\"%s\",\"timestamp\":%I64d}",
      login, balance, equity, margin, freeM, curr, lev, broker, server, (long)TimeCurrent()
   );
   PostToWebhook(json);
}

void SendOpenPositions()
{
   string positions = "[";
   int total = PositionsTotal();
   bool first = true;
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      if(!first) positions += ",";
      first = false;

      positions += StringFormat(
         "{\"ticket\":%I64u,\"symbol\":\"%s\",\"type\":%d,\"volume\":%.2f,\"entry\":%.5f,\"sl\":%.5f,\"tp\":%.5f,\"profit\":%.2f,\"time\":%I64d}",
         ticket,
         PositionGetString(POSITION_SYMBOL),
         (int)PositionGetInteger(POSITION_TYPE),
         PositionGetDouble(POSITION_VOLUME),
         PositionGetDouble(POSITION_PRICE_OPEN),
         PositionGetDouble(POSITION_SL),
         PositionGetDouble(POSITION_TP),
         PositionGetDouble(POSITION_PROFIT),
         (long)PositionGetInteger(POSITION_TIME)
      );
   }
   positions += "]";

   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string json = StringFormat(
      "{\"type\":\"positions\",\"platform\":\"mt5\",\"account\":%I64d,\"positions\":%s}",
      login, positions
   );
   PostToWebhook(json);
}

void PostToWebhook(string body)
{
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + SecretToken + "\r\n";
   char data[]; char result[];
   StringToCharArray(body, data, 0, StringLen(body), CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1); // strip null terminator

   string responseHeaders;
   ResetLastError();
   int code = WebRequest("POST", WebhookURL, headers, 15000, data, result, responseHeaders);

   if(code == -1)
   {
      Print("WebRequest failed. Error ", GetLastError(),
            " — add ", WebhookURL, " to Tools > Options > Expert Advisors > Allow WebRequest.");
   }
   else if(code == 200)
      Print("InfinoX sync OK");
   else
      Print("Webhook HTTP ", code, ": ", CharArrayToString(result));
}
