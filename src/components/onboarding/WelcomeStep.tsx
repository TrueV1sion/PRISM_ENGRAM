"use client";

import { motion } from "framer-motion";
import { Hexagon, ChevronRight } from "lucide-react";

export default function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 blur-3xl bg-prism-sky/20 rounded-full scale-150" />
        <Hexagon
          className="w-20 h-20 text-prism-sky relative z-10"
          strokeWidth={1.5}
        />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-4xl md:text-5xl font-bold mb-4"
      >
        <span className="bg-gradient-to-r from-white via-prism-sky to-prism-cerulean bg-clip-text text-transparent">
          PRISM
        </span>
        <span className="text-prism-muted font-light ml-3">|</span>
        <span className="text-white font-light ml-3">Strategic Intelligence</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="text-prism-muted text-lg max-w-2xl leading-relaxed mb-12"
      >
        PRISM deploys coordinated AI agent teams to analyze complex strategic
        questions across multiple dimensions simultaneously, synthesizing
        findings into executive-ready intelligence briefs.
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        onClick={onNext}
        className="flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-medium bg-prism-sky text-prism-bg shadow-[0_0_20px_rgba(89,221,253,0.25)] hover:bg-white transition-all duration-300"
      >
        Get Started
        <ChevronRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
}
