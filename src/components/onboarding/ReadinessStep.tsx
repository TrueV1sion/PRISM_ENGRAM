"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Key, ChevronRight, ChevronLeft } from "lucide-react";

interface ReadinessStepProps {
  keys: { anthropic: boolean; openai: boolean };
  onSaveKey: (provider: string, key: string) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

function KeyCard({
  provider,
  label,
  ready,
  required,
  onSave,
}: {
  provider: string;
  label: string;
  ready: boolean;
  required: boolean;
  onSave: (provider: string, key: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    await onSave(provider, value.trim());
    setSaving(false);
    setEditing(false);
    setValue("");
  };

  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Key className="w-4 h-4 text-prism-muted" />
          <span className="text-sm font-medium text-white">{label}</span>
          {required ? (
            <span className="text-[10px] font-mono px-1.5 py-px rounded bg-prism-sky/10 text-prism-sky border border-prism-sky/20">
              REQUIRED
            </span>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-px rounded bg-white/5 text-prism-muted border border-white/5">
              OPTIONAL
            </span>
          )}
        </div>
        {ready ? (
          <CheckCircle2 className="w-5 h-5 text-prism-jade" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        )}
      </div>

      {ready ? (
        <p className="text-xs text-prism-jade">Configured and ready</p>
      ) : editing ? (
        <div className="flex gap-2 mt-3">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Enter ${label}...`}
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-prism-muted/50 focus:outline-none focus:border-prism-sky/40"
          />
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-prism-sky text-prism-bg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-prism-sky hover:text-white transition-colors mt-1"
        >
          Click to configure
        </button>
      )}
    </div>
  );
}

export default function ReadinessStep({
  keys,
  onSaveKey,
  onNext,
  onBack,
}: ReadinessStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="flex flex-col items-center justify-center min-h-screen px-6"
    >
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">System Readiness</h2>
          <p className="text-sm text-prism-muted">
            PRISM checks your environment to ensure everything is configured.
          </p>
        </div>

        <div className="space-y-3">
          <KeyCard
            provider="anthropic"
            label="Anthropic API Key"
            ready={keys.anthropic}
            required={true}
            onSave={onSaveKey}
          />
          <KeyCard
            provider="openai"
            label="OpenAI API Key"
            ready={keys.openai}
            required={false}
            onSave={onSaveKey}
          />
        </div>

        <p className="text-xs text-prism-muted text-center">
          Demo Mode is always available without API keys.
        </p>

        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-5 py-2.5 rounded-lg text-sm text-prism-muted border border-white/10 hover:border-white/20 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-medium bg-prism-sky text-prism-bg shadow-[0_0_20px_rgba(89,221,253,0.25)] hover:bg-white transition-all duration-300"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
