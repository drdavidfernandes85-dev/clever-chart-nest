import { useEffect, useState } from "react";
import {
  Calendar,
  Plus,
  Radio,
  Save,
  Trash2,
  Video,
  StopCircle,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Webinar } from "@/hooks/useWebinars";

/**
 * Admin tab for scheduling, going live, ending and removing webinars.
 * Mounted inside src/pages/Admin.tsx as a new <TabsContent value="webinars">.
 */
const AdminWebinarsTab = () => {
  const [items, setItems] = useState<Webinar[]>([]);
  const [form, setForm] = useState({
    title: "",
    topic: "",
    host_name: "",
    description: "",
    scheduled_at: "",
    duration_minutes: 60,
    stream_url: "",
    recording_url: "",
    thumbnail_url: "",
    performance_impact: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("webinars" as any)
      .select("*")
      .order("scheduled_at", { ascending: false });
    setItems((data ?? []) as unknown as Webinar[]);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.title || !form.host_name || !form.scheduled_at) {
      toast.error("Title, host and scheduled time are required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("webinars" as any).insert({
      title: form.title,
      topic: form.topic || null,
      host_name: form.host_name,
      description: form.description || null,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: Number(form.duration_minutes) || 60,
      stream_url: form.stream_url || null,
      recording_url: form.recording_url || null,
      thumbnail_url: form.thumbnail_url || null,
      performance_impact: form.performance_impact || null,
      status: "scheduled",
    } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Webinar scheduled");
      setForm({
        title: "",
        topic: "",
        host_name: "",
        description: "",
        scheduled_at: "",
        duration_minutes: 60,
        stream_url: "",
        recording_url: "",
        thumbnail_url: "",
        performance_impact: "",
      });
      load();
    }
  };

  const setStatus = async (id: string, status: Webinar["status"]) => {
    const { error } = await supabase
      .from("webinars" as any)
      .update({ status } as any)
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Status updated to ${status}`);
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this webinar permanently?")) return;
    const { error } = await supabase.from("webinars" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  return (
    <div className="space-y-4">
      {/* Create */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> Schedule a webinar
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="London session live trading"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Host *</Label>
            <Input
              value={form.host_name}
              onChange={(e) => setForm({ ...form, host_name: e.target.value })}
              placeholder="Alex Rodriguez"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Topic</Label>
            <Input
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder="EUR/USD breakout playbook"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Performance impact tag</Label>
            <Input
              value={form.performance_impact}
              onChange={(e) =>
                setForm({ ...form, performance_impact: e.target.value })
              }
              placeholder="High impact / Educational / Q&A"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Scheduled at *</Label>
            <Input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Duration (minutes)</Label>
            <Input
              type="number"
              min={15}
              max={480}
              value={form.duration_minutes}
              onChange={(e) =>
                setForm({ ...form, duration_minutes: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Stream URL (YouTube Live, Zoom…)</Label>
            <Input
              value={form.stream_url}
              onChange={(e) => setForm({ ...form, stream_url: e.target.value })}
              placeholder="https://youtube.com/live/…"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Recording URL (after end)</Label>
            <Input
              value={form.recording_url}
              onChange={(e) => setForm({ ...form, recording_url: e.target.value })}
              placeholder="https://youtu.be/…"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Thumbnail URL</Label>
            <Input
              value={form.thumbnail_url}
              onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
              placeholder="https://…/thumb.jpg"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What we'll cover in this session…"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={create} disabled={saving} className="rounded-xl gap-1.5">
            <Save className="h-4 w-4" />
            {saving ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
      </Card>

      {/* List */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" /> All webinars ({items.length})
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">No webinars scheduled yet.</p>
        ) : (
          <div className="divide-y divide-border/40">
            {items.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{w.title}</p>
                    <Badge
                      variant="outline"
                      className={
                        w.status === "live"
                          ? "border-destructive/40 bg-destructive/10 text-destructive text-[10px]"
                          : w.status === "ended"
                            ? "border-border/40 text-[10px]"
                            : w.status === "canceled"
                              ? "border-destructive/40 text-destructive text-[10px]"
                              : "border-primary/40 bg-primary/10 text-primary text-[10px]"
                      }
                    >
                      {w.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <Calendar className="h-3 w-3" />
                    {new Date(w.scheduled_at).toLocaleString()}
                    <span>· {w.host_name}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={w.status}
                    onValueChange={(v) => setStatus(w.id, v as Webinar["status"])}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="ended">Ended</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                    </SelectContent>
                  </Select>
                  {w.status === "scheduled" && (
                    <Button
                      size="sm"
                      onClick={() => setStatus(w.id, "live")}
                      className="rounded-lg h-8 gap-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs"
                    >
                      <Radio className="h-3 w-3" /> Go live
                    </Button>
                  )}
                  {w.status === "live" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus(w.id, "ended")}
                      className="rounded-lg h-8 gap-1 text-xs"
                    >
                      <StopCircle className="h-3 w-3" /> End
                    </Button>
                  )}
                  {w.status === "ended" && w.recording_url && (
                    <a
                      href={w.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 text-xs text-primary hover:bg-primary/20"
                    >
                      <PlayCircle className="h-3 w-3" /> Watch
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(w.id)}
                    className="text-destructive h-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminWebinarsTab;
