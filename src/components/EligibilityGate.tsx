import { ReactNode } from "react";
import { useMTAccount } from "@/hooks/useMTAccount";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import AccessDeniedScreen from "./AccessDeniedScreen";

const MIN_BALANCE_USD = 100;

interface Props {
  children: ReactNode;
}

const Spinner = () => (
  <div className="flex h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(45,100%,50%)] border-t-transparent" />
  </div>
);

/**
 * Gates a protected page behind eligibility:
 *  - Connected MT account
 *  - Live (not demo)
 *  - status === "connected" (verified link to broker)
 *  - balance >= $100 USD
 *
 * Admins always pass. Use only on routes that require full Live Trading
 * Room access — DO NOT wrap webinars or /connect-mt.
 */
const EligibilityGate = ({ children }: Props) => {
  const { account, loading } = useMTAccount();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  if ((loading && !account) || adminLoading) return <Spinner />;

  if (isAdmin) return <>{children}</>;

  if (!account) {
    return <AccessDeniedScreen reason="no_account" />;
  }

  if (account.account_type !== "live") {
    return <AccessDeniedScreen reason="not_live" />;
  }

  if (account.status !== "connected") {
    return <AccessDeniedScreen reason="not_verified" />;
  }

  const balance = account.balance ?? 0;
  if (balance < MIN_BALANCE_USD) {
    return (
      <AccessDeniedScreen
        reason="low_balance"
        balance={balance}
        currency={account.currency}
      />
    );
  }

  return <>{children}</>;
};

export default EligibilityGate;
