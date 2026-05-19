import { ReactNode } from "react";
import { useMTAccount } from "@/hooks/useMTAccount";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import AccessDeniedScreen from "./AccessDeniedScreen";
import { canAccessFullPlatform } from "@/lib/accessMode";

interface Props {
  children: ReactNode;
}

const Spinner = () => (
  <div className="flex h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(45,100%,50%)] border-t-transparent" />
  </div>
);

/**
 * Gates a protected page behind eligibility. Delegates the actual decision
 * to `canAccessFullPlatform` in src/lib/accessMode.ts — that is the single
 * source of truth and respects the temporary review/testing bypass flag.
 *
 * Admins always pass.
 */
const EligibilityGate = ({ children }: Props) => {
  const { account, loading } = useMTAccount();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  if ((loading && !account) || adminLoading) return <Spinner />;
  if (isAdmin) return <>{children}</>;

  const decision = canAccessFullPlatform(account);
  if (decision.allowed) return <>{children}</>;

  if (decision.reason === "low_balance") {
    return (
      <AccessDeniedScreen
        reason="low_balance"
        balance={account?.balance ?? 0}
        currency={account?.currency}
      />
    );
  }
  return <AccessDeniedScreen reason={decision.reason as "no_account" | "not_live" | "not_verified"} />;
};

export default EligibilityGate;
