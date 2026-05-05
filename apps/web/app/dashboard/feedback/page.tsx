// BETA-ONLY: REMOVE FOR PUBLIC LAUNCH
// Delete this entire directory (apps/web/app/dashboard/feedback/) at public launch.
"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Bug, Lightbulb, ListChecks, Trophy, ShieldCheck,
  ThumbsUp, ThumbsDown, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  verified: "Verified",
  in_progress: "In Progress",
  fixed: "Fixed",
  rejected: "Rejected",
};

const STATUS_COLOR: Record<string, string> = {
  submitted: "bg-zinc-700 text-zinc-200",
  verified: "bg-blue-600/30 text-blue-300",
  in_progress: "bg-amber-600/30 text-amber-300",
  fixed: "bg-emerald-600/30 text-emerald-300",
  rejected: "bg-red-600/30 text-red-300",
};

const SEV_COLOR: Record<string, string> = {
  low: "bg-zinc-700 text-zinc-300",
  med: "bg-amber-600/30 text-amber-300",
  high: "bg-red-600/30 text-red-300",
};

type Tab = "submit" | "mine" | "known" | "features" | "leaderboard" | "admin";
type SubmitMode = "bug" | "feature";

export default function FeedbackPage() {
  const [tab, setTab] = useState<Tab>("submit");
  const { data: amIAdmin } = api.beta.amIAdmin.useQuery();

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "submit", label: "Submit", icon: <Bug className="h-3.5 w-3.5" /> },
    { id: "mine", label: "My Reports", icon: <ListChecks className="h-3.5 w-3.5" /> },
    { id: "known", label: "Known Bugs", icon: <Bug className="h-3.5 w-3.5" /> },
    { id: "features", label: "Features", icon: <Lightbulb className="h-3.5 w-3.5" /> },
    { id: "leaderboard", label: "Leaderboard", icon: <Trophy className="h-3.5 w-3.5" /> },
    ...(amIAdmin ? [{ id: "admin" as Tab, label: "Admin", icon: <ShieldCheck className="h-3.5 w-3.5" /> }] : []),
  ];

  return (
    <div className="space-y-5 pt-4 pb-24 px-4 text-white">
      <div className="mb-6 flex items-center gap-3">
        <BackButton href="/dashboard/settings" />
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none mb-1">
            Beta Feedback
          </h1>
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
            Help us find bugs · earn rewards
          </p>
        </div>
      </div>

      {/* Rewards banner */}
      <Card variant="premium" className="rounded-2xl border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4">
          <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-1">Reward Tiers</p>
          <p className="text-xs text-zinc-300 leading-relaxed">
            $1 per 2 verified bugs · Bonus $3 at milestones 5 / 10 / 15 / 20 bugs
          </p>
        </CardContent>
      </Card>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
              tab === t.id
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200",
            ].join(" ")}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "submit" && <SubmitTab />}
      {tab === "mine" && <MyBugsTab />}
      {tab === "known" && <KnownBugsTab />}
      {tab === "features" && <FeaturesTab />}
      {tab === "leaderboard" && <LeaderboardTab />}
      {tab === "admin" && amIAdmin && <AdminTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submit Tab
// ---------------------------------------------------------------------------

function SubmitTab() {
  const [mode, setMode] = useState<SubmitMode>("bug");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["bug", "feature"] as SubmitMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={[
              "flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
              mode === m
                ? m === "bug"
                  ? "bg-red-600/30 text-red-300 border border-red-500/30"
                  : "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                : "bg-white/5 text-zinc-500 border border-white/5 hover:bg-white/10",
            ].join(" ")}
          >
            {m === "bug" ? "🐛 Report a Bug" : "💡 Feature Request"}
          </button>
        ))}
      </div>
      {mode === "bug" ? <BugForm /> : <FeatureForm />}
    </div>
  );
}

function BugForm() {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [steps, setSteps] = useState("");
  const [severity, setSeverity] = useState<"low" | "med" | "high">("med");
  const utils = api.useUtils();

  const submit = api.beta.submitBug.useMutation({
    onSuccess: () => {
      toast.success("Bug report submitted! Thanks for helping out.");
      setTitle(""); setDesc(""); setSteps(""); setSeverity("med");
      void utils.beta.listMyBugs.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card variant="premium" className="rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Short description of the bug"
            className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-blue-500/50" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Description</Label>
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="What happened? What did you expect?"
            className="bg-white/5 border-white/10 text-white rounded-xl focus:border-blue-500/50 min-h-[80px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Steps to Reproduce (optional)</Label>
          <Textarea value={steps} onChange={(e) => setSteps(e.target.value)}
            placeholder="1. Go to... 2. Tap... 3. See error"
            className="bg-white/5 border-white/10 text-white rounded-xl focus:border-blue-500/50 min-h-[60px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Severity</Label>
          <div className="flex gap-2">
            {(["low", "med", "high"] as const).map((s) => (
              <button key={s} onClick={() => setSeverity(s)}
                className={[
                  "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  severity === s ? SEV_COLOR[s] + " border border-current/30" : "bg-white/5 text-zinc-500",
                ].join(" ")}>{s}</button>
            ))}
          </div>
        </div>
        <Button onClick={() => submit.mutate({ title, description: desc, stepsToReproduce: steps || undefined, severity })}
          disabled={submit.isPending || !title || !desc}
          className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-sm">
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          SUBMIT BUG REPORT
        </Button>
      </CardContent>
    </Card>
  );
}

function FeatureForm() {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const utils = api.useUtils();

  const submit = api.beta.submitFeature.useMutation({
    onSuccess: () => {
      toast.success("Feature request submitted!");
      setTitle(""); setDesc("");
      void utils.beta.listFeatures.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card variant="premium" className="rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="What feature would you like?"
            className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-purple-500/50" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Description</Label>
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Describe the feature and why it would be useful."
            className="bg-white/5 border-white/10 text-white rounded-xl focus:border-purple-500/50 min-h-[80px]" />
        </div>
        <Button onClick={() => submit.mutate({ title, description: desc })}
          disabled={submit.isPending || !title || !desc}
          className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-sm">
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          SUBMIT FEATURE REQUEST
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// My Reports Tab
// ---------------------------------------------------------------------------

function MyBugsTab() {
  const { data, isLoading } = api.beta.listMyBugs.useQuery();

  if (isLoading) return <LoadingCard />;
  if (!data?.length) return <EmptyCard text="You haven't submitted any bugs yet." />;

  return (
    <div className="space-y-3">
      {data.map((bug) => (
        <Card key={bug.id} variant="premium" className="rounded-2xl">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-white leading-snug flex-1">{bug.title}</p>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0 ${STATUS_COLOR[bug.status]}`}>
                {STATUS_LABEL[bug.status]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${SEV_COLOR[bug.severity]}`}>
                {bug.severity}
              </span>
              <span className="text-[10px] text-zinc-500">{new Date(bug.created_at).toLocaleDateString()}</span>
            </div>
            {bug.admin_note && (
              <p className="text-xs text-zinc-400 bg-white/5 rounded-lg px-3 py-2 border border-white/5 italic">
                Admin: {bug.admin_note}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Known Bugs Tab
// ---------------------------------------------------------------------------

function KnownBugsTab() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = api.beta.listKnownBugs.useQuery();

  const filtered = (data ?? []).filter((b) =>
    b.title.toLowerCase().includes(search.toLowerCase()),
  );

  if (isLoading) return <LoadingCard />;

  return (
    <div className="space-y-3">
      <Input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search known bugs…"
        className="bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-blue-500/50" />
      {!filtered.length ? (
        <EmptyCard text={search ? "No matching bugs found." : "No known bugs yet."} />
      ) : (
        filtered.map((bug) => (
          <Card key={bug.id} variant="premium" className="rounded-2xl">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-white leading-snug flex-1">{bug.title}</p>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0 ${STATUS_COLOR[bug.status]}`}>
                  {STATUS_LABEL[bug.status]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${SEV_COLOR[bug.severity]}`}>
                  {bug.severity}
                </span>
                <span className="text-[10px] text-zinc-500">{new Date(bug.created_at).toLocaleDateString()}</span>
              </div>
              {bug.admin_note && (
                <p className="text-xs text-zinc-300 bg-white/5 rounded-lg px-3 py-2 border border-white/5 leading-relaxed italic">
                  💬 {bug.admin_note}
                </p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Features Tab
// ---------------------------------------------------------------------------

function FeaturesTab() {
  const { data, isLoading } = api.beta.listFeatures.useQuery();
  const utils = api.useUtils();
  const vote = api.beta.voteFeature.useMutation({
    onSuccess: () => void utils.beta.listFeatures.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <LoadingCard />;
  if (!data?.length) return <EmptyCard text="No feature requests yet. Submit one!" />;

  const FEAT_STATUS: Record<string, string> = {
    open: "bg-zinc-700 text-zinc-300",
    planned: "bg-blue-600/30 text-blue-300",
    shipped: "bg-emerald-600/30 text-emerald-300",
    declined: "bg-red-600/30 text-red-300",
  };

  return (
    <div className="space-y-3">
      {data.map((f) => (
        <Card key={f.id} variant="premium" className="rounded-2xl">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-bold text-white leading-snug">{f.title}</p>
                <p className="text-xs text-zinc-400 leading-relaxed">{f.description}</p>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0 ${FEAT_STATUS[f.status]}`}>
                {f.status}
              </span>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => vote.mutate({ featureId: f.id, value: 1 })}
                className={["flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all",
                  f.myVote === 1 ? "bg-emerald-600/30 text-emerald-300" : "bg-white/5 text-zinc-400 hover:bg-white/10"].join(" ")}
              >
                <ThumbsUp className="h-3.5 w-3.5" /> {f.score > 0 ? `+${f.score}` : ""}
              </button>
              <button
                onClick={() => vote.mutate({ featureId: f.id, value: -1 })}
                className={["flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all",
                  f.myVote === -1 ? "bg-red-600/30 text-red-300" : "bg-white/5 text-zinc-400 hover:bg-white/10"].join(" ")}
              >
                <ThumbsDown className="h-3.5 w-3.5" /> {f.score < 0 ? f.score : ""}
              </button>
              <span className="text-[10px] text-zinc-600 ml-auto">{new Date(f.created_at).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard Tab
// ---------------------------------------------------------------------------

function LeaderboardTab() {
  const { data, isLoading } = api.beta.leaderboard.useQuery();

  if (isLoading) return <LoadingCard />;
  if (!data?.length) return <EmptyCard text="No verified bugs yet. Be the first!" />;

  return (
    <div className="space-y-3">
      {data.map((entry) => (
        <Card key={entry.providerId} variant="premium" className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={[
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0",
                entry.rank === 1 ? "bg-amber-500 text-black" :
                entry.rank === 2 ? "bg-zinc-400 text-black" :
                entry.rank === 3 ? "bg-amber-700 text-white" : "bg-zinc-700 text-zinc-300",
              ].join(" ")}>
                {entry.rank}
              </div>
              {entry.avatarUrl ? (
                <img src={entry.avatarUrl} alt={entry.name} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-black text-zinc-400">
                  {entry.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{entry.name}</p>
                <p className="text-xs text-zinc-400">{entry.verifiedCount} verified bug{entry.verifiedCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-emerald-400">${entry.dollars}</p>
                {entry.nextMilestone && (
                  <p className="text-[10px] text-zinc-500">next bonus at {entry.nextMilestone}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin Tab
// ---------------------------------------------------------------------------

type EditState = {
  validity: "pending" | "verified" | "rejected";
  progress: "open" | "in_progress" | "fixed";
  note: string;
};

function dbStatusToEdit(status: string, adminNote: string | null): EditState {
  const note = adminNote ?? "";
  if (status === "rejected") return { validity: "rejected", progress: "open", note };
  if (status === "in_progress") return { validity: "verified", progress: "in_progress", note };
  if (status === "fixed") return { validity: "verified", progress: "fixed", note };
  if (status === "verified") return { validity: "verified", progress: "open", note };
  return { validity: "pending", progress: "open", note };
}

function editToDbStatus(edit: EditState): "submitted" | "verified" | "in_progress" | "fixed" | "rejected" {
  if (edit.validity === "rejected") return "rejected";
  if (edit.validity === "verified") {
    if (edit.progress === "in_progress") return "in_progress";
    if (edit.progress === "fixed") return "fixed";
    return "verified";
  }
  return "submitted";
}

function AdminTab() {
  const [statusFilter, setStatusFilter] = useState<"submitted" | "verified" | "in_progress" | "fixed" | "rejected" | "all">("submitted");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, EditState>>({});

  const { data, isLoading, refetch } = api.beta.admin.listAllBugs.useQuery({ status: statusFilter });
  const setBugStatus = api.beta.admin.setBugStatus.useMutation({
    onSuccess: (_data, vars) => {
      toast.success("Status updated");
      setExpanded((prev) => { const n = new Set(prev); n.delete(vars.id); return n; });
      void refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const FILTER_OPTIONS = ["submitted", "verified", "in_progress", "fixed", "rejected", "all"] as const;

  function toggleExpand(bug: Record<string, unknown>) {
    const id = bug.id as string;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setEdits((e) => ({
          ...e,
          [id]: e[id] ?? dbStatusToEdit(bug.status as string, bug.admin_note as string | null),
        }));
      }
      return next;
    });
  }

  function handleSave(id: string) {
    const edit = edits[id];
    if (!edit) return;
    setBugStatus.mutate({ id, status: editToDbStatus(edit), adminNote: edit.note || undefined });
  }

  function handleCancel(id: string, bug: Record<string, unknown>) {
    setEdits((e) => ({ ...e, [id]: dbStatusToEdit(bug.status as string, bug.admin_note as string | null) }));
    setExpanded((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {FILTER_OPTIONS.map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={["px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
              statusFilter === f ? "bg-blue-600 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"].join(" ")}>
            {f}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingCard /> : !data?.length ? <EmptyCard text="No submissions here." /> : (
        <div className="space-y-2">
          {data.map((bug: Record<string, unknown>) => {
            const id = bug.id as string;
            const isOpen = expanded.has(id);
            const edit = edits[id];
            const profiles = bug.profiles as { name?: string; email?: string } | null;

            return (
              <Card key={id} variant="premium" className="rounded-2xl overflow-hidden">
                {/* Collapsed header — always visible */}
                <button
                  type="button"
                  onClick={() => toggleExpand(bug)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-bold text-white truncate">{bug.title as string}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${SEV_COLOR[bug.severity as string]}`}>
                        {bug.severity as string}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${STATUS_COLOR[bug.status as string]}`}>
                        {STATUS_LABEL[bug.status as string]}
                      </span>
                    </div>
                  </div>
                  {isOpen
                    ? <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />}
                </button>

                {/* Expanded body */}
                {isOpen && edit && (
                  <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
                    {/* Submitter */}
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      {profiles?.name ?? "Unknown"} · {profiles?.email ?? ""}
                    </p>

                    {/* Description */}
                    <p className="text-xs text-zinc-300 bg-white/5 rounded-xl px-3 py-2.5 border border-white/5 leading-relaxed">
                      {bug.description as string}
                    </p>

                    {/* Steps */}
                    {(bug.steps_to_reproduce as string | null) && (
                      <p className="text-xs text-zinc-400 italic leading-relaxed">
                        Steps: {bug.steps_to_reproduce as string}
                      </p>
                    )}

                    {/* Two dropdowns */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Validity</p>
                        <select
                          value={edit.validity}
                          onChange={(e) => setEdits((prev) => ({
                            ...prev,
                            [id]: { ...prev[id]!, validity: e.target.value as EditState["validity"] },
                          }))}
                          className="w-full bg-zinc-800 border border-white/10 text-white text-xs rounded-xl px-3 py-2.5 font-bold focus:border-blue-500/50 focus:outline-none cursor-pointer"
                        >
                          <option value="pending">⏳ Pending</option>
                          <option value="verified">✅ Verified</option>
                          <option value="rejected">❌ Rejected</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Progress</p>
                        <select
                          value={edit.progress}
                          disabled={edit.validity !== "verified"}
                          onChange={(e) => setEdits((prev) => ({
                            ...prev,
                            [id]: { ...prev[id]!, progress: e.target.value as EditState["progress"] },
                          }))}
                          className="w-full bg-zinc-800 border border-white/10 text-white text-xs rounded-xl px-3 py-2.5 font-bold focus:border-blue-500/50 focus:outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <option value="open">📋 Open</option>
                          <option value="in_progress">🔧 In Progress</option>
                          <option value="fixed">✅ Fixed</option>
                        </select>
                      </div>
                    </div>

                    {/* Admin note */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Note (visible to all users)</p>
                      <Textarea
                        value={edit.note}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id]!, note: e.target.value } }))}
                        placeholder="Add a public note about this bug…"
                        className="bg-white/5 border-white/10 text-white rounded-xl text-xs focus:border-blue-500/50 min-h-[60px]"
                      />
                    </div>

                    {/* Save / Cancel */}
                    <div className="flex gap-3">
                      <Button
                        variant="ghost"
                        onClick={() => handleCancel(id, bug)}
                        disabled={setBugStatus.isPending}
                        className="flex-1 h-11 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl text-xs font-black uppercase tracking-widest"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleSave(id)}
                        disabled={setBugStatus.isPending}
                        className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20"
                      >
                        {setBugStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function LoadingCard() {
  return (
    <Card variant="premium" className="rounded-2xl">
      <CardContent className="p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </CardContent>
    </Card>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card variant="premium" className="rounded-2xl">
      <CardContent className="p-6 text-center">
        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{text}</p>
      </CardContent>
    </Card>
  );
}
