import { useEffect, useState } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface FollowButtonProps {
  targetUserId: string;
}

const FollowButton = ({ targetUserId }: FollowButtonProps) => {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.id === targetUserId) { setLoading(false); return; }
    supabase
      .from("follows" as any)
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .maybeSingle()
      .then(({ data }) => { setFollowing(!!data); setLoading(false); });
  }, [user, targetUserId]);

  if (!user || user.id === targetUserId) return null;

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    if (following) {
      const { error } = await supabase
        .from("follows" as any)
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId);
      if (error) toast.error("Failed to unfollow");
      else setFollowing(false);
    } else {
      const { error } = await supabase
        .from("follows" as any)
        .insert({ follower_id: user.id, following_id: targetUserId });
      if (error) toast.error("Failed to follow");
      else { setFollowing(true); toast.success("Following"); }
    }
    setLoading(false);
  };

  return (
    <Button
      onClick={toggle}
      disabled={loading}
      size="sm"
      variant={following ? "outline" : "default"}
      className="rounded-full gap-1.5"
    >
      {following ? <><UserCheck className="h-3.5 w-3.5" /> Following</> : <><UserPlus className="h-3.5 w-3.5" /> Follow</>}
    </Button>
  );
};

export default FollowButton;
