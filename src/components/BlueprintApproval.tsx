"use client";

import { motion } from "framer-motion";
import type { BlueprintData } from "@/lib/types";
import { Users, Zap, Clock, Layers, ChevronRight, Pencil } from "lucide-react";

const tierColors: Record<string, string> = {
    MICRO: "text-prism-muted bg-white/5 border-white/10",
    STANDARD: "text-prism-sky bg-prism-sky/10 border-prism-sky/30",
    EXTENDED: "text-prism-jade bg-prism-jade/10 border-prism-jade/30",
    MEGA: "text-amber-400 bg-amber-400/10 border-amber-400/30",
};

export default function BlueprintApproval({
    blueprint,
    onApprove,
}: {
    blueprint: BlueprintData;
    onApprove: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center p-6 md:p-10 overflow-y-auto"
        >
            <div className="w-full max-w-5xl space-y-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-3"
                >
                    <div className="inline-flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full bg-prism-sky/10 text-prism-sky border border-prism-sky/20">
                        <Layers className="w-3.5 h-3.5" />
                        HITL GATE 1: BLUEPRINT APPROVAL
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white">Analysis Blueprint</h2>
                    <p className="text-sm text-prism-muted max-w-2xl mx-auto leading-relaxed">
                        Review the proposed dimensional decomposition and agent roster before deploying. You can adjust the scope or modify agent assignments.
                    </p>
                </motion.div>

                {/* Query Summary */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-panel rounded-xl p-5"
                >
                    <p className="text-xs font-mono text-prism-muted mb-2">QUERY</p>
                    <p className="text-white leading-relaxed">{blueprint.query}</p>
                </motion.div>

                {/* Metadata Row */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4"
                >
                    <div className="glass-panel rounded-xl p-4 text-center">
                        <p className="text-xs font-mono text-prism-muted mb-1">SWARM TIER</p>
                        <span className={`text-sm font-bold px-3 py-1 rounded-full border ${tierColors[blueprint.tier]}`}>
                            {blueprint.tier}
                        </span>
                    </div>
                    <div className="glass-panel rounded-xl p-4 text-center">
                        <p className="text-xs font-mono text-prism-muted mb-1">AGENTS</p>
                        <div className="flex items-center justify-center gap-1.5">
                            <Users className="w-4 h-4 text-prism-cerulean" />
                            <span className="text-lg font-bold text-white">{blueprint.agents.length}</span>
                        </div>
                    </div>
                    <div className="glass-panel rounded-xl p-4 text-center">
                        <p className="text-xs font-mono text-prism-muted mb-1">COMPLEXITY</p>
                        <div className="flex items-center justify-center gap-1.5">
                            <Zap className="w-4 h-4 text-amber-400" />
                            <span className="text-lg font-bold text-white">{blueprint.complexity.total}</span>
                        </div>
                    </div>
                    <div className="glass-panel rounded-xl p-4 text-center">
                        <p className="text-xs font-mono text-prism-muted mb-1">EST. TIME</p>
                        <div className="flex items-center justify-center gap-1.5">
                            <Clock className="w-4 h-4 text-prism-jade" />
                            <span className="text-lg font-bold text-white">{blueprint.estimatedTime}</span>
                        </div>
                    </div>
                </motion.div>

                {/* Dimension ↔ Agent Mapping */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-3"
                >
                    <h3 className="text-sm font-mono text-prism-muted uppercase tracking-wider">
                        Dimensional Decomposition
                    </h3>
                    <div className="space-y-3">
                        {blueprint.agents.map((agent, i) => (
                            <motion.div
                                key={agent.id}
                                initial={{ opacity: 0, x: -15 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.25 + i * 0.08 }}
                                className="glass-panel rounded-xl p-4 flex items-center gap-4 group hover:border-white/10 transition-colors"
                            >
                                {/* Color indicator */}
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: `${agent.color}15`, border: `1px solid ${agent.color}30` }}
                                >
                                    <span className="text-lg font-bold" style={{ color: agent.color }}>
                                        {agent.name.charAt(0)}
                                    </span>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-semibold text-sm text-white">{agent.name}</h4>
                                        <span className="text-[10px] font-mono px-1.5 py-px rounded bg-white/5 text-prism-muted">
                                            {agent.archetype}
                                        </span>
                                    </div>
                                    <p className="text-xs text-prism-muted truncate">{agent.mandate}</p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {agent.tools.map((tool) => (
                                        <span
                                            key={tool}
                                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-prism-muted/70 border border-white/5 hidden md:inline"
                                        >
                                            {tool}
                                        </span>
                                    ))}
                                </div>

                                <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-white/5">
                                    <Pencil className="w-3.5 h-3.5 text-prism-muted" />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center justify-center gap-4 pt-4 pb-8"
                >
                    <button
                        onClick={onApprove}
                        data-tour-id="tour-deploy-agents"
                        className="flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-medium bg-prism-sky text-prism-bg shadow-[0_0_20px_rgba(89,221,253,0.25)] hover:bg-white transition-all duration-300"
                    >
                        Deploy Agents
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </motion.div>
            </div>
        </motion.div>
    );
}
