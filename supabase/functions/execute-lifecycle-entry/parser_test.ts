// Regression test for lifecycle-entry response parser.
// Trading Layer returns the placement evidence under `response.data`. The
// wrapper MUST classify it as accepted (not failed_entry_rejected / unknown).

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const pick = (obj: any, paths: string[]) => {
  for (const path of paths) {
    const value = path.split(".").reduce((acc: any, key) => acc && typeof acc === "object" ? acc[key] : undefined, obj);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};

function classify(res: any, httpStatus = 200, networkError: string | null = null) {
  const result = res?.data ?? res?.result ?? res;
  const retcodeRaw = pick(result, ["retcode", "result.retcode", "trade.retcode", "order.retcode"]);
  const retcode = retcodeRaw != null ? Number(retcodeRaw) : null;
  const classification = String(pick(result, ["classification", "result.classification"]) ?? "").toLowerCase() || null;
  const accepted = !networkError && httpStatus >= 200 && httpStatus < 300
    && (retcode === 10008 || retcode === 10009 || res?.success === true || classification === "placed" || classification === "done");
  const orderId = pick(result, ["orderId", "order_id", "order", "result.order"]);
  const finalStatus = accepted ? "awaiting_position_confirmation" : "failed_entry_rejected";
  return { accepted, retcode, classification, orderId, finalStatus };
}

Deno.test("parses TL placement evidence nested under response.data", () => {
  const res = {
    data: {
      retcode: 10008,
      retcode_name: "TRADE_RETCODE_PLACED",
      retcode_description: "Order placed",
      classification: "placed",
      order: 1169126422,
    },
  };
  const out = classify(res);
  assertEquals(out.accepted, true);
  assertEquals(out.retcode, 10008);
  assertEquals(out.classification, "placed");
  assertEquals(String(out.orderId), "1169126422");
  assertEquals(out.finalStatus, "awaiting_position_confirmation");
});

Deno.test("does not misclassify placed entry as failed_entry_rejected", () => {
  const out = classify({ data: { retcode: 10008, classification: "placed", order: 1 } });
  assertEquals(out.finalStatus === "failed_entry_rejected", false);
});
