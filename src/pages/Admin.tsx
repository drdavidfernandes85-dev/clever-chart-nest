import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Hash, MessageSquare, UserX, Megaphone, Plus, Trash2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import AdminWebinarsTab from "@/components/admin/AdminWebinarsTab";

interface Channel { id: string; name: string; category: string; }
interface Profile { user_id: string; display_name: string; }
interface Mute { id: string; user_id: string; reason: string | null; muted_until: string | null; created_at: string; }
interface MessageRow { id: string; content: string; user_id: string; created_at: string; channel_id: string; deleted_at: string | null; }

const Admin = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mutes, setMutes] = useState<Mute[]>([]);
  const [recentMessages, setRecentMessages] = useState<MessageRow[]>([]);
  const [newChannel, setNewChannel] = useState("");
  const [newCategory, setNewCategory] = useState("Channels");
  const [muteSearch, setMuteSearch] = useState("");
  const [muteReason, setMuteReason] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const loadAll = async () => {
    const [{ data: c }, { data: p }, { data: m }, { data: msgs }, { data: a }] = await Promise.all([
      supabase.from("channels").select("*").order("created_at"),
      supabase.from("profiles").select("user_id, display_name").order("display_name"),
      (supabase.from as any)("mute_list").select("*").order("created_at", { ascending: false }),
      supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(40),
      (supabase.from as any)("site_settings").select("value").eq("key", "announcement").maybeSingle(),
    ]);
    setChannels((c ?? []) as Channel[]);
    setProfiles((p ?? []) as Profile[]);
    setMutes((m ?? []) as Mute[]);
    setRecentMessages((msgs ?? []) as MessageRow[]);
    if (a?.value && typeof a.value === "object" && "text" in a.value) {
      setAnnouncement((a.value as any).text || "");
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ---- Channels ----
  const addChannel = async () => {
    if (!newChannel.trim()) return;
    const { error } = await supabase.from("channels").insert({
      name: newChannel.trim().toLowerCase().replace(/\s+/g, "_"),
      category: newCategory,
    });
    if (error) toast.error(error.message); else { toast.success("Channel created"); setNewChannel(""); loadAll(); }
  };
  const deleteChannel = async (id: string) => {
    const { error } = await supabase.from("channels").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); loadAll(); }
  };

  // ---- Mutes ----
  const filteredProfiles = profiles.filter((p) =>
    p.display_name.toLowerCase().includes(muteSearch.toLowerCase())
  ).slice(0, 8);
  const muteUser = async (userId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await (supabase.from as any)("mute_list").upsert({
      user_id: userId,
      reason: muteReason || null,
      created_by: user.id,
    }, { onConflict: "user_id" });
    if (error) toast.error(error.message); else { toast.success("User muted"); setMuteReason(""); loadAll(); }
  };
  const unmuteUser = async (id: string) => {
    const { error } = await (supabase.from as any)("mute_list").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Unmuted"); loadAll(); }
  };

  // ---- Messages soft-delete ----
  const softDelete = async (id: string) => {
    const { error } = await supabase.from("messages").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Message hidden"); loadAll(); }
  };

  // ---- Announcement ----
  const saveAnnouncement = async () => {
    const { error } = await (supabase.from as any)("site_settings").upsert(
      { key: "announcement", value: { text: announcement, updated_at: new Date().toISOString() } },
      { onConflict: "key" }
    );
    if (error) toast.error(error.message); else toast.success("Announcement updated");
  };

  // ---- Roles ----
  const grantModerator = async (userId: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "moderator" as const });
    if (error) toast.error(error.message); else toast.success("Moderator role granted");
  };

  const profileFor = (uid: string) => profiles.find((p) => p.user_id === uid)?.display_name ?? uid.slice(0, 8);

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SEO title="Admin Console | Elite Live Trading Room" description="Moderation tools for admins." />
      <header className="sticky top-0 z-40 border-b border-border/30 bg-background/90 backdrop-blur-2xl">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={infinoxLogo} alt="INFINOX" className="h-5" />
            <span className="hidden sm:inline text-[10px] text-muted-foreground/30">|</span>
            <Badge variant="secondary" className="rounded-full text-[10px] uppercase tracking-wider gap-1">
              <Shield className="h-3 w-3" /> Admin
            </Badge>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Link>
          </Button>
        </div>
      </header>

      <div className="container max-w-5xl py-8">
        <h1 className="font-heading text-3xl font-bold text-foreground mb-6">
          Moderation <span className="text-primary">Console</span>
        </h1>

        <Tabs defaultValue="webinars">
          <TabsList className="grid w-full grid-cols-5 max-w-3xl">
            <TabsTrigger value="webinars"><Radio className="h-3.5 w-3.5 mr-1.5" /> Webinars</TabsTrigger>
            <TabsTrigger value="channels"><Hash className="h-3.5 w-3.5 mr-1.5" /> Channels</TabsTrigger>
            <TabsTrigger value="messages"><MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Messages</TabsTrigger>
            <TabsTrigger value="mutes"><UserX className="h-3.5 w-3.5 mr-1.5" /> Mutes</TabsTrigger>
            <TabsTrigger value="announce"><Megaphone className="h-3.5 w-3.5 mr-1.5" /> Banner</TabsTrigger>
          </TabsList>

          {/* WEBINARS */}
          <TabsContent value="webinars" className="mt-4">
            <AdminWebinarsTab />
          </TabsContent>

          {/* CHANNELS */}
          <TabsContent value="channels" className="mt-4 space-y-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Create channel</h3>
              <div className="flex flex-wrap gap-2">
                <Input value={newChannel} onChange={(e) => setNewChannel(e.target.value)} placeholder="trades_room" className="max-w-[220px]" />
                <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category" className="max-w-[160px]" />
                <Button onClick={addChannel} className="rounded-xl"><Plus className="h-4 w-4 mr-1" /> Add</Button>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">All channels ({channels.length})</h3>
              <div className="divide-y divide-border/50">
                {channels.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{c.name}</span>
                      <Badge variant="outline" className="text-[10px]">{c.category}</Badge>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => deleteChannel(c.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* MESSAGES */}
          <TabsContent value="messages" className="mt-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Recent messages (last 40)</h3>
              <div className="space-y-2">
                {recentMessages.map((m) => (
                  <div key={m.id} className={`flex items-start gap-3 rounded-xl border border-border/40 p-3 ${m.deleted_at ? "opacity-50" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 text-xs">
                        <span className="font-semibold text-foreground">{profileFor(m.user_id)}</span>
                        <span className="text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                        {m.deleted_at && <Badge variant="destructive" className="text-[9px]">hidden</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground break-words">{m.content}</p>
                    </div>
                    {!m.deleted_at && (
                      <Button size="sm" variant="ghost" onClick={() => softDelete(m.id)} className="text-destructive shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* MUTES */}
          <TabsContent value="mutes" className="mt-4 space-y-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Mute a user</h3>
              <div className="space-y-2">
                <Input value={muteSearch} onChange={(e) => setMuteSearch(e.target.value)} placeholder="Search by display name…" />
                <Input value={muteReason} onChange={(e) => setMuteReason(e.target.value)} placeholder="Reason (optional)" />
                {muteSearch && (
                  <div className="space-y-1 mt-2">
                    {filteredProfiles.map((p) => (
                      <div key={p.user_id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                        <span className="text-sm">{p.display_name}</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => grantModerator(p.user_id)}>Make Mod</Button>
                          <Button size="sm" variant="destructive" onClick={() => muteUser(p.user_id)}>Mute</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Active mutes ({mutes.length})</h3>
              <div className="divide-y divide-border/50">
                {mutes.length === 0 && <p className="text-sm text-muted-foreground py-4">No muted users.</p>}
                {mutes.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">{profileFor(m.user_id)}</p>
                      {m.reason && <p className="text-xs text-muted-foreground">{m.reason}</p>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => unmuteUser(m.id)}>Unmute</Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* ANNOUNCEMENT */}
          <TabsContent value="announce" className="mt-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Site-wide announcement</h3>
              <Textarea value={announcement} onChange={(e) => setAnnouncement(e.target.value)} rows={3} placeholder="High-impact NFP today at 13:30 UTC. Trade carefully." />
              <p className="text-[11px] text-muted-foreground mt-2">Leave empty to hide the banner.</p>
              <div className="flex justify-end mt-3">
                <Button onClick={saveAnnouncement} className="rounded-xl">Save</Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
