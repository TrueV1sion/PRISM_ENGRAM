"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronLeft, Sparkles } from "lucide-react";

interface ReadyStepProps {
  onDismiss: (dontShowAgain: boolean) => void;
  onBack: () => void;
}

export default function ReadyStep({ onDismiss, onBack }: ReadyStepProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <CheckCircle2 className="w-16 h-16 text-prism-jade" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold text-white mb-3"
      >
        You&apos;re All Set
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-prism-muted max-w-md mb-8"
      >
        PRISM is ready. Enter a strategic question and watch coordinated AI
        agents analyze it across multiple dimensions in real time.
      </motion.p>

      <motion.label
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-2 mb-8 cursor-pointer select-none"
      >
        <input
          type="checkbox"
          checked={dontShowAgain}
          onChange={(e) => setDontShowAgain(e.target.checked)}
          className="w-4 h-4 rounded border-white/20 bg-white/5 text-prism-sky focus:ring-prism-sky/30"
        />
        <span className="text-xs text-prism-muted">
          Don&apos;t show this again
        </span>
      </motion.label>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex items-center gap-4"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-5 py-2.5 rounded-lg text-sm text-prism-muted border border-white/10 hover:border-white/20 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={() => onDismiss(dontShowAgain)}
          className="flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-medium bg-prism-sky text-prism-bg shadow-[0_0_20px_rgba(89,221,253,0.25)] hover:bg-white transition-all duration-300"
        >
          <Sparkles className="w-4 h-4" />
          Begin Analysis
        </button>
      </motion.div>
    </motion.div>
  );
}
