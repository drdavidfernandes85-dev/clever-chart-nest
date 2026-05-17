import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, GraduationCap } from "lucide-react";
import { toast } from "sonner";

interface MentorApp {
  id: string;
  user_id: string;
  full_name: string;
  experience_years: number;
  trading_style: string | null;
  pairs: string | null;
  bio: string;
  status: string;
  created_at: string;
}

const statusBadge = (s: string) => {
  if (s === "approved") return <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Approved</Badge>;
  if (s === "rejected") return <Badge className="bg-red-500/15 text-red-300 border-red-500/30">Rejected</Badge>;
  return <Badge className="bg-[#FFCD05]/15 text-[#FFCD05] border-[#FFCD05]/30">Pending</Badge>;
};

const AdminMentorApplicationsTab = () => {
  const [apps, setApps] = useState<MentorApp[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("mentor_applications")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (data || []) as MentorApp[];
    setApps(list);
    const ids = Array.from(new Set(list.map((a) => a.user_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
      const map: Record<string, string> = {};
      (ps || []).forEach((p: any) => { map[p.user_id] = p.display_name; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (app: MentorApp, status: "approved" | "rejected") => {
    setBusyId(app.id);
    const { error } = await supabase
      .from("mentor_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", app.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Application approved — mentor role granted" : "Application rejected");
    load();
  };

  const visible = apps.filter((a) => filter === "all" || a.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-[#FFCD05]" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Mentor Applications</h3>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#0F0F0F] p-1">
          {(["pending", "approved", "rejected", "all"] as const).map((k) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                filter === k ? "bg-[#FFCD05] text-black" : "text-white/50 hover:text-white"
              }`}>{k}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-white/40 text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading applications…
        </div>
      ) : visible.length === 0 ? (
        <Card className="border-white/10 bg-[#0F0F0F] p-10 text-center text-white/50 text-sm">
          No {filter === "all" ? "" : filter} applications.
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((app) => (
            <Card key={app.id} className="border-white/10 bg-[#0F0F0F] p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{app.full_name}</p>
                    {statusBadge(app.status)}
                  </div>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {profiles[app.user_id] ? `@${profiles[app.user_id]} · ` : ""}
                    {new Date(app.created_at).toLocaleString()}
                  </p>
                </div>
                {app.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" disabled={busyId === app.id} onClick={() => updateStatus(app, "approved")}
                      className="h-8 bg-emerald-500/90 hover:bg-emerald-500 text-white gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === app.id} onClick={() => updateStatus(app, "rejected")}
                      className="h-8 border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 gap-1.5">
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Experience</p>
                  <p className="text-white font-mono">{app.experience_years} yrs</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Style</p>
                  <p className="text-white">{app.trading_style || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Pairs</p>
                  <p className="text-white">{app.pairs || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Bio</p>
                <p className="text-sm text-white/80 whitespace-pre-wrap">{app.bio}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMentorApplicationsTab;
