"use client";

/**
 * PhaseSkeleton — Shimmer loading skeleton shown during phase transitions.
 *
 * Displays a contextual loading state based on the upcoming phase.
 * Uses a CSS shimmer effect for that polished, premium feel.
 */

import { motion } from "framer-motion";
import { Activity, Layers, CheckCircle, Hexagon, Search, Shield } from "lucide-react";

type SkeletonVariant = "thinking" | "deploying" | "synthesizing" | "verifying" | "presenting" | "generic";

interface PhaseSkeletonProps {
  variant?: SkeletonVariant;
  message?: string;
}

const VARIANT_CONFIG: Record<SkeletonVariant, {
  icon: typeof Activity;
  title: string;
  subtitle: string;
  color: string;
}> = {
  thinking: {
    icon: Search,
    title: "Analyzing Query",
    subtitle: "Decomposing into analytical dimensions...",
    color: "text-prism-sky",
  },
  deploying: {
    icon: Hexagon,
    title: "Deploying Agents",
    subtitle: "Spawning parallel research agents...",
    color: "text-prism-jade",
  },
  synthesizing: {
    icon: Layers,
    title: "Synthesizing Intelligence",
    subtitle: "Running emergence detection...",
    color: "text-prism-sky",
  },
  verifying: {
    icon: Shield,
    title: "Quality Assurance",
    subtitle: "Evaluating provenance and scoring output...",
    color: "text-amber-400",
  },
  presenting: {
    icon: Activity,
    title: "Generating Presentation",
    subtitle: "Building HTML5 intelligence briefing...",
    color: "text-prism-sky",
  },
  generic: {
    icon: Activity,
    title: "Processing",
    subtitle: "Pipeline in progress...",
    color: "text-prism-sky",
  },
};

function ShimmerBar({ width, delay = 0 }: { width: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0.3 }}
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 1.5, repeat: Infinity, delay }}
      className="h-3 rounded-full bg-gradient-to-r from-white/5 via-white/10 to-white/5"
      style={{ width }}
    />
  );
}

export default function PhaseSkeleton({
  variant = "generic",
  message,
}: PhaseSkeletonProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-8 max-w-md"
      >
        {/* Animated icon */}
        <div className="relative w-20 h-20 mx-auto">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-current opacity-20"
            style={{ color: "var(--prism-sky, #38bdf8)" }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0, 0.2] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-2 rounded-full border border-current opacity-15"
            style={{ color: "var(--prism-jade, #34d399)" }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0, 0.15] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
          />
          <div className={`absolute inset-4 rounded-full bg-white/5 flex items-center justify-center`}>
            <Icon className={`w-8 h-8 ${config.color} animate-pulse`} strokeWidth={1.5} />
          </div>
        </div>

        {/* Title + subtitle */}
        <div>
          <h2 className="text-xl font-bold text-white mb-2">{config.title}</h2>
          <p className="text-sm text-prism-muted">
            {message || config.subtitle}
          </p>
        </div>

        {/* Shimmer skeleton bars */}
        <div className="space-y-3 w-full px-8">
          <ShimmerBar width="100%" />
          <ShimmerBar width="85%" delay={0.2} />
          <ShimmerBar width="70%" delay={0.4} />
        </div>
      </motion.div>
    </div>
  );
}
