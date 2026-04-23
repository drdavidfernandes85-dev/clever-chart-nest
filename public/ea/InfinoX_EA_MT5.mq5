//+------------------------------------------------------------------+
//| InfinoX_EA_MT5_to_Lovable.mq5                                    |
//| Sends account & open positions to your Elite Live Trading Room   |
//| Lovable Cloud webhook every 10 seconds.                          |
//+------------------------------------------------------------------+
#property copyright "InfinoX Elite Room"
#property version   "1.01"
#property strict

input string WebhookURL  = "{{WEBHOOK_URL}}";   // Pre-filled when downloaded from your dashboard
input string SecretToken = "{{SECRET_TOKEN}}";  // Pre-filled when downloaded from your dashboard

datetime lastSend = 0;

int OnInit()
{
   Print("✅ InfinoX EA v1.01 loaded successfully. Webhook: ", WebhookURL);
   if(StringLen(SecretToken) < 16)
      Print("⚠️ WARNING: SecretToken looks empty/short. Re-download EA from your dashboard.");
   return(INIT_SUCCEEDED);
}

void OnTick()
{
   if(TimeCurrent() - lastSend < 10) return;
   lastSend = TimeCurrent();
   SendAccountInfo();
   SendOpenPositions();
}

void SendAccountInfo()
{
   string json = StringFormat(
      "{\"type\":\"account\",\"platform\":\"mt5\",\"account\":%I64d,\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,\"free_margin\":%.2f,\"timestamp\":%I64d}",
      AccountInfoInteger(ACCOUNT_LOGIN),
      AccountInfoDouble(ACCOUNT_BALANCE),
      AccountInfoDouble(ACCOUNT_EQUITY),
      AccountInfoDouble(ACCOUNT_MARGIN),
      AccountInfoDouble(ACCOUNT_MARGIN_FREE),
      (long)TimeCurrent()
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
         "{\"ticket\":%I64u,\"symbol\":\"%s\",\"type\":%d,\"volume\":%.2f,\"entry\":%.5f,\"sl\":%.5f,\"tp\":%.5f,\"profit\":%.2f}",
         ticket,
         PositionGetString(POSITION_SYMBOL),
         (int)PositionGetInteger(POSITION_TYPE),
         PositionGetDouble(POSITION_VOLUME),
         PositionGetDouble(POSITION_PRICE_OPEN),
         PositionGetDouble(POSITION_SL),
         PositionGetDouble(POSITION_TP),
         PositionGetDouble(POSITION_PROFIT)
      );
   }
   positions += "]";

   string json = StringFormat(
      "{\"type\":\"positions\",\"platform\":\"mt5\",\"account\":%I64d,\"positions\":%s}",
      AccountInfoInteger(ACCOUNT_LOGIN), positions
   );
   PostToWebhook(json);
}

void PostToWebhook(string json)
{
   char postData[];
   StringToCharArray(json, postData, 0, StringLen(json), CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1); // strip null terminator

   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + SecretToken + "\r\n";
   char result[];
   string responseHeaders;

   ResetLastError();
   int res = WebRequest("POST", WebhookURL, headers, 30000, postData, result, responseHeaders);

   if(res == -1)
      Print("❌ WebRequest failed. Error ", GetLastError(),
            " — add ", WebhookURL, " to Tools > Options > Expert Advisors > Allow WebRequest.");
   else if(res == 200)
      Print("✅ Data sent successfully");
   else
      Print("❌ Webhook failed. Code: ", res, " Body: ", CharArrayToString(result));
}
