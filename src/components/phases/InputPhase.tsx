"use client";

import { motion } from "framer-motion";
import { Send, Zap, Hexagon } from "lucide-react";

interface InputPhaseProps {
    query: string;
    setQuery: (query: string) => void;
    onSubmitLive: (e: React.FormEvent) => void;
    onOpenSettings: () => void;
}

export default function InputPhase({
    query,
    setQuery,
    onSubmitLive,
    onOpenSettings,
}: InputPhaseProps) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
            {/* Ambient grid background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-prism-panel via-prism-bg to-prism-bg" />
            <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `linear-gradient(rgba(89,221,253,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(89,221,253,0.3) 1px, transparent 1px)`,
                backgroundSize: "60px 60px",
            }} />

            <div className="w-full max-w-4xl flex flex-col items-center gap-12 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center space-y-4"
                >
                    <div className="flex items-center justify-center gap-4 mb-6">
                        <Hexagon className="w-16 h-16 text-prism-sky/80 animate-[pulse_4s_ease-in-out_infinite]" strokeWidth={1} />
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-prism-sky to-prism-cerulean">
                        Strategic Intelligence
                    </h1>
                    <p className="text-xl text-prism-muted max-w-2xl mx-auto font-light">
                        Parallel multi-agent pipeline for complex dimensional analysis, emergence detection, and strategic presentation.
                    </p>
                    <button
                        onClick={onOpenSettings}
                        className="text-xs text-prism-muted/40 hover:text-prism-sky transition-colors mt-2"
                    >
                        ⚙ Platform Settings
                    </button>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="w-full relative group"
                >
                    <div className="absolute -inset-1 bg-gradient-to-r from-prism-cerulean via-prism-sky to-prism-jade rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />

                    <form onSubmit={onSubmitLive} className="relative glass-panel rounded-2xl p-2 flex flex-col gap-4 overflow-hidden">
                        <div className="relative">
                            <Zap className="absolute left-4 top-4 text-prism-sky/50 w-6 h-6" />
                            <textarea
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Initialize strategic analysis (e.g., 'Analyze GLP-1 impact on MA payer margins...')"
                                className="w-full bg-transparent text-white placeholder:text-prism-muted/50 p-4 pl-14 min-h-[120px] resize-none outline-none text-lg font-light leading-relaxed"
                            />
                        </div>

                        <div className="flex items-center justify-between px-4 pb-2">
                            <div className="flex items-center gap-4 text-xs font-mono text-prism-muted/60">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-prism-jade animate-pulse" />
                                    Claude Native Orchestration
                                </span>
                                <span className="hidden md:inline-flex items-center gap-1 border-l border-white/5 pl-4">
                                    Tiered Emergence Detection
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="submit"
                                    disabled={!query.trim()}
                                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all duration-300 ${query.trim()
                                        ? "bg-prism-sky text-prism-bg shadow-[0_0_20px_rgba(89,221,253,0.3)] hover:bg-white"
                                        : "bg-white/5 text-white/30 cursor-not-allowed"
                                        }`}
                                >
                                    Run Live Analysis
                                    <Send className="w-4 h-4 ml-1" />
                                </button>
                            </div>
                        </div>
                    </form>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex flex-wrap justify-center gap-3 w-full max-w-3xl">
                    {["CMS 2027 Star Ratings Cut-Points", "GLP-1 Weight Loss Strategic Opportunity", "Medicare Advantage Margin Pressures"].map((q, i) => (
                        <button
                            key={i}
                            onClick={() => setQuery(`Analyze the strategic impact of ${q} on healthcare payer positioning and competitive dynamics`)}
                            className="text-sm text-prism-muted hover:text-prism-sky bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/5 transition-colors"
                        >
                            {q}
                        </button>
                    ))}
                </motion.div>
            </div>
        </div>
    );
}
