import { useEffect, useState, useRef } from "react";
import { User, Camera, ArrowLeft, Save, Trophy, Mail, RefreshCw, Shield, BarChart3, Plug, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import XPBar from "@/components/gamification/XPBar";
import BadgeShelf from "@/components/gamification/BadgeShelf";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useLanguage } from "@/i18n/LanguageContext";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import ChangePasswordCard from "@/components/ChangePasswordCard";

const Profile = () => {
  const { user, profile } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { t } = useLanguage();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [leaderboardOptOut, setLeaderboardOptOut] = useState(false);
  const [emailDigestOptIn, setEmailDigestOptIn] = useState(true);
  const [webinarEmail, setWebinarEmail] = useState(true);
  const [webinarInapp, setWebinarInapp] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("leaderboard_opt_out")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLeaderboardOptOut(!!(data as any).leaderboard_opt_out);
      });
    (supabase.from as any)("user_settings")
      .select("webinar_email_reminders, webinar_inapp_reminders, email_digest_optin")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data) {
          if (typeof data.webinar_email_reminders === "boolean")
            setWebinarEmail(data.webinar_email_reminders);
          if (typeof data.webinar_inapp_reminders === "boolean")
            setWebinarInapp(data.webinar_inapp_reminders);
          if (typeof data.email_digest_optin === "boolean")
            setEmailDigestOptIn(data.email_digest_optin);
        }
      });
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${user.id}.${ext}`;
      const { error } = await supabase.storage
        .from("chat-attachments")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("chat-attachments")
        .getPublicUrl(path);
      setAvatarUrl(urlData.publicUrl);
      toast.success(t("profile.avatarUploaded"));
    } catch (err: any) {
      toast.error(err.message || t("profile.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          avatar_url: avatarUrl || null,
          leaderboard_opt_out: leaderboardOptOut,
        } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      await (supabase.from as any)("user_settings").upsert(
        {
          user_id: user.id,
          email_digest_optin: emailDigestOptIn,
          webinar_email_reminders: webinarEmail,
          webinar_inapp_reminders: webinarInapp,
        },
        { onConflict: "user_id" }
      );
      toast.success(t("profile.saved"));
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || t("profile.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SEO
        title="My Profile | IX LTR"
        description="Manage your trader profile, avatar and leaderboard visibility."
        canonical="https://elitelivetradingroom.com/profile"
      />
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-2xl">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-3">
              <img src={infinoxLogo} alt="INFINOX" className="h-5" />
              <span className="hidden sm:inline text-[10px] text-muted-foreground/30">|</span>
              <span className="hidden sm:inline font-heading text-sm font-semibold text-foreground">
                <span className="text-primary">IX</span> LTR
              </span>
            </Link>
          </div>
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              {t("common.back")}
            </Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-8 p-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground uppercase tracking-tight">
            {t("profile.title1")} <span className="text-primary">{t("profile.title2")}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("profile.subtitle")}</p>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative h-24 w-24 cursor-pointer rounded-full border-2 border-border overflow-hidden group"
            onClick={() => fileRef.current?.click()}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/20 text-primary">
                <User className="h-10 w-10" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-6 w-6 text-foreground" />
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <p className="text-xs text-muted-foreground">
            {uploading ? t("profile.uploading") : t("profile.clickAvatar")}
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-muted-foreground">{t("profile.email")}</Label>
            <Input
              id="email"
              value={user?.email ?? ""}
              disabled
              className="bg-secondary/50 border-border/50 text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm text-foreground">{t("profile.displayName")}</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("profile.displayPlaceholder")}
              className="bg-card border-border/50"
            />
          </div>
        </div>

        {/* Privacy */}
        <div className="rounded-2xl border border-border/40 bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
                <Trophy className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("profile.showLeaderboard")}</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                  {t("profile.showLeaderboardDesc")}
                </p>
              </div>
            </div>
            <Switch
              checked={!leaderboardOptOut}
              onCheckedChange={(v) => setLeaderboardOptOut(!v)}
            />
          </div>
        </div>

        {/* Email digest */}
        <div className="rounded-2xl border border-border/40 bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("profile.weeklyDigest")}</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                  {t("profile.weeklyDigestDesc")}
                </p>
              </div>
            </div>
            <Switch checked={emailDigestOptIn} onCheckedChange={setEmailDigestOptIn} />
          </div>
        </div>

        {/* Gamification */}
        <XPBar />
        <BadgeShelf />

        {/* Tour + admin */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem("onboarding_completed");
              window.location.href = "/dashboard";
            }}
            className="rounded-xl gap-1.5"
          >
            <RefreshCw className="h-4 w-4" /> {t("profile.restartTour")}
          </Button>
          <Button variant="outline" asChild className="rounded-xl gap-1.5">
            <Link to="/analytics"><BarChart3 className="h-4 w-4" /> {t("profile.myAnalytics")}</Link>
          </Button>
          <Button asChild className="rounded-xl gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/connect-mt"><Plug className="h-4 w-4" /> {t("profile.connectMT")}</Link>
          </Button>
          {isAdmin && (
            <Button variant="outline" asChild className="rounded-xl gap-1.5">
              <Link to="/admin"><Shield className="h-4 w-4" /> {t("profile.adminConsole")}</Link>
            </Button>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/80"
        >
          <Save className="h-4 w-4" />
          {saving ? t("profile.saving") : t("profile.save")}
        </Button>

        <ChangePasswordCard />
      </div>
    </div>
  );
};

export default Profile;
