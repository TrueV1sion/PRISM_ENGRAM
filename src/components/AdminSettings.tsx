"use client";

/**
 * Admin Settings Panel — PRISM Configuration
 * 
 * Manages platform-wide settings:
 * - Model provider configuration
 * - Quality gate thresholds
 * - Skill toggles
 * - Pipeline behavior
 * - API key management
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Brain, Shield, Zap, Key, ChevronRight, ToggleLeft, ToggleRight, Save, ArrowLeft, Loader2 } from "lucide-react";
import { DEFAULT_SETTINGS, type SettingsState } from "@/lib/settings-types";

const ALL_SKILLS = [
    { id: "healthcare-quality-analytics", name: "Healthcare Quality Analytics", description: "CMS Stars, HEDIS, quality improvement" },
    { id: "stars-2027-navigator", name: "Stars 2027 Navigator", description: "Cut-point projections, measure strategy" },
    { id: "payer-financial-decoder", name: "Payer Financial Decoder", description: "MLR, PMPM, margin analysis" },
    { id: "regulatory-radar", name: "Regulatory Radar", description: "CMS rules, Federal Register, compliance" },
    { id: "competitor-battlecard", name: "Competitor Battlecard", description: "SWOT, market positioning, strategic assets" },
    { id: "deal-room-intelligence", name: "Deal Room Intelligence", description: "M&A signals, valuation frameworks" },
    { id: "healthcare-ma-signal-hunter", name: "Healthcare M&A Signal Hunter", description: "Transaction alerts, filing analysis" },
    { id: "drug-pipeline-intel", name: "Drug Pipeline Intel", description: "Clinical trials, FDA pathways, patent cliffs" },
    { id: "product-hunter", name: "Product Hunter", description: "Market gaps, opportunity assessment" },
];

const MODEL_OPTIONS = [
    { value: "claude-sonnet-4-6", label: "Claude 4.6 Sonnet" },
    { value: "claude-opus-4-6", label: "Claude 4.6 Opus" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];



export default function AdminSettings({ onBack }: { onBack: () => void }) {
    const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
    const [activeTab, setActiveTab] = useState<"models" | "quality" | "pipeline" | "skills" | "keys">("models");
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Load settings from API on mount
    useEffect(() => {
        fetch("/api/settings")
            .then(r => r.json())
            .then((data: SettingsState) => setSettings(data))
            .catch(() => { }) // fall back to defaults
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch {
            // Could show an error toast here
        } finally {
            setSaving(false);
        }
    };

    const toggleSkill = (id: string) => {
        setSettings(prev => ({
            ...prev,
            enabledSkills: prev.enabledSkills.includes(id)
                ? prev.enabledSkills.filter(s => s !== id)
                : [...prev.enabledSkills, id],
        }));
    };

    const tabs = [
        { id: "models" as const, label: "Models", icon: Brain },
        { id: "quality" as const, label: "Quality Gates", icon: Shield },
        { id: "pipeline" as const, label: "Pipeline", icon: Zap },
        { id: "skills" as const, label: "Skills", icon: Settings },
        { id: "keys" as const, label: "API Keys", icon: Key },
    ];

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-prism-sky animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto">
            <div className="w-full max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="p-2 rounded-lg border border-white/10 hover:border-white/20 text-prism-muted hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
                            <p className="text-sm text-prism-muted">Configure PRISM intelligence pipeline</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${saved
                            ? "bg-prism-jade text-prism-bg"
                            : saving ? "bg-white/10 text-prism-muted cursor-wait"
                                : "bg-prism-sky text-prism-bg hover:bg-white"
                            }`}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saved ? "Saved!" : saving ? "Saving..." : "Save Settings"}
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 border-b border-white/5 pb-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-t-lg transition-colors ${activeTab === tab.id
                                ? "bg-white/5 text-white border-b-2 border-prism-sky"
                                : "text-prism-muted hover:text-white"
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Models Tab */}
                        {activeTab === "models" && (
                            <div className="space-y-6">
                                <div className="glass-panel rounded-xl p-6 space-y-5">
                                    <h3 className="text-sm font-semibold text-white">Model Configuration</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs text-prism-muted mb-2">Primary Model</label>
                                            <select
                                                value={settings.primaryModel}
                                                onChange={e => setSettings(s => ({ ...s, primaryModel: e.target.value }))}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-prism-sky/50"
                                            >
                                                {MODEL_OPTIONS.map(m => (
                                                    <option key={m.value} value={m.value} className="bg-prism-bg">{m.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-prism-muted mb-2">Fallback Model</label>
                                            <select
                                                value={settings.fallbackModel}
                                                onChange={e => setSettings(s => ({ ...s, fallbackModel: e.target.value }))}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-prism-sky/50"
                                            >
                                                {MODEL_OPTIONS.map(m => (
                                                    <option key={m.value} value={m.value} className="bg-prism-bg">{m.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs text-prism-muted mb-2">Temperature: {settings.temperature}</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={settings.temperature}
                                                onChange={e => setSettings(s => ({ ...s, temperature: parseFloat(e.target.value) }))}
                                                className="w-full accent-prism-sky"
                                            />
                                            <div className="flex justify-between text-[10px] text-prism-muted mt-1">
                                                <span>Precise</span>
                                                <span>Creative</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-prism-muted mb-2">Max Tokens: {settings.maxTokens}</label>
                                            <input
                                                type="range"
                                                min="2048"
                                                max="16384"
                                                step="1024"
                                                value={settings.maxTokens}
                                                onChange={e => setSettings(s => ({ ...s, maxTokens: parseInt(e.target.value) }))}
                                                className="w-full accent-prism-sky"
                                            />
                                            <div className="flex justify-between text-[10px] text-prism-muted mt-1">
                                                <span>2K</span>
                                                <span>16K</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Quality Gates Tab */}
                        {activeTab === "quality" && (
                            <div className="space-y-4">
                                {(["blueprint", "findings", "synthesis"] as const).map(gate => {
                                    const enabled = settings[`${gate}GateEnabled` as keyof SettingsState] as boolean;
                                    const threshold = settings[`${gate}AutoApproveThreshold` as keyof SettingsState] as number;
                                    const gateLabels = {
                                        blueprint: { title: "Blueprint Gate", desc: "Review dimensional decomposition before agent deployment" },
                                        findings: { title: "Findings Gate", desc: "Triage agent findings before synthesis" },
                                        synthesis: { title: "Synthesis Gate", desc: "Review synthesis quality before completion" },
                                    };

                                    return (
                                        <div key={gate} className="glass-panel rounded-xl p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-white">{gateLabels[gate].title}</h3>
                                                    <p className="text-xs text-prism-muted mt-1">{gateLabels[gate].desc}</p>
                                                </div>
                                                <button
                                                    onClick={() => setSettings(s => ({ ...s, [`${gate}GateEnabled`]: !enabled }))}
                                                    className="text-prism-sky"
                                                >
                                                    {enabled
                                                        ? <ToggleRight className="w-8 h-8" />
                                                        : <ToggleLeft className="w-8 h-8 text-prism-muted" />
                                                    }
                                                </button>
                                            </div>
                                            {enabled && (
                                                <div>
                                                    <label className="block text-xs text-prism-muted mb-2">
                                                        Auto-approve threshold: {threshold}%
                                                    </label>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        step="5"
                                                        value={threshold}
                                                        onChange={e => setSettings(s => ({
                                                            ...s,
                                                            [`${gate}AutoApproveThreshold`]: parseInt(e.target.value),
                                                        }))}
                                                        className="w-full accent-prism-sky"
                                                    />
                                                    <div className="flex justify-between text-[10px] text-prism-muted mt-1">
                                                        <span>Always manual</span>
                                                        <span>Always auto</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Pipeline Tab */}
                        {activeTab === "pipeline" && (
                            <div className="space-y-6">
                                <div className="glass-panel rounded-xl p-6 space-y-5">
                                    <h3 className="text-sm font-semibold text-white">Pipeline Behavior</h3>

                                    <div>
                                        <label className="block text-xs text-prism-muted mb-2">Default Urgency</label>
                                        <div className="flex gap-3">
                                            {(["speed", "balanced", "thorough"] as const).map(u => (
                                                <button
                                                    key={u}
                                                    onClick={() => setSettings(s => ({ ...s, defaultUrgency: u }))}
                                                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${settings.defaultUrgency === u
                                                        ? "bg-prism-sky/20 text-prism-sky border border-prism-sky/40"
                                                        : "bg-white/5 text-prism-muted border border-white/5 hover:border-white/15"
                                                        }`}
                                                >
                                                    {u.charAt(0).toUpperCase() + u.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-prism-muted mb-2">Max Agents: {settings.maxAgents}</label>
                                        <input
                                            type="range"
                                            min="2"
                                            max="15"
                                            step="1"
                                            value={settings.maxAgents}
                                            onChange={e => setSettings(s => ({ ...s, maxAgents: parseInt(e.target.value) }))}
                                            className="w-full accent-prism-sky"
                                        />
                                        <div className="flex justify-between text-[10px] text-prism-muted mt-1">
                                            <span>MICRO (2)</span>
                                            <span>MEGA (15)</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between py-3 border-t border-white/5">
                                        <div>
                                            <span className="text-sm text-white">Memory Bus</span>
                                            <p className="text-xs text-prism-muted mt-0.5">Cross-agent signal propagation</p>
                                        </div>
                                        <button onClick={() => setSettings(s => ({ ...s, enableMemoryBus: !s.enableMemoryBus }))}>
                                            {settings.enableMemoryBus
                                                ? <ToggleRight className="w-8 h-8 text-prism-sky" />
                                                : <ToggleLeft className="w-8 h-8 text-prism-muted" />
                                            }
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between py-3 border-t border-white/5">
                                        <div>
                                            <span className="text-sm text-white">Critic Pass</span>
                                            <p className="text-xs text-prism-muted mt-0.5">Post-synthesis quality review (STANDARD+ tiers)</p>
                                        </div>
                                        <button onClick={() => setSettings(s => ({ ...s, enableCriticPass: !s.enableCriticPass }))}>
                                            {settings.enableCriticPass
                                                ? <ToggleRight className="w-8 h-8 text-prism-sky" />
                                                : <ToggleLeft className="w-8 h-8 text-prism-muted" />
                                            }
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Skills Tab */}
                        {activeTab === "skills" && (
                            <div className="space-y-3">
                                {ALL_SKILLS.map(skill => {
                                    const enabled = settings.enabledSkills.includes(skill.id);
                                    return (
                                        <div key={skill.id} className="glass-panel rounded-xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${enabled ? "bg-prism-jade" : "bg-white/10"}`} />
                                                <div>
                                                    <h4 className="text-sm font-medium text-white">{skill.name}</h4>
                                                    <p className="text-xs text-prism-muted">{skill.description}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => toggleSkill(skill.id)}>
                                                {enabled
                                                    ? <ToggleRight className="w-8 h-8 text-prism-jade" />
                                                    : <ToggleLeft className="w-8 h-8 text-prism-muted" />
                                                }
                                            </button>
                                        </div>
                                    );
                                })}
                                <div className="text-xs text-prism-muted text-center pt-4">
                                    {settings.enabledSkills.length}/{ALL_SKILLS.length} skills enabled
                                </div>
                            </div>
                        )}

                        {/* API Keys Tab */}
                        {activeTab === "keys" && (
                            <div className="space-y-4">
                                {[
                                    { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key", required: true },
                                    { key: "OPENAI_API_KEY", label: "OpenAI API Key", required: false },
                                    { key: "GOOGLE_GENERATIVE_AI_API_KEY", label: "Google AI API Key", required: false },
                                    { key: "FRED_API_KEY", label: "FRED Economic Data Key", required: false },
                                    { key: "CENSUS_API_KEY", label: "Census Bureau API Key", required: false },
                                ].map(apiKey => (
                                    <div key={apiKey.key} className="glass-panel rounded-xl p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Key className="w-4 h-4 text-prism-sky" />
                                                <span className="text-sm font-medium text-white">{apiKey.label}</span>
                                                {apiKey.required && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 font-mono">Required</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-mono text-prism-muted">{apiKey.key}</span>
                                        </div>
                                        <input
                                            type="password"
                                            placeholder="sk-..."
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white font-mono outline-none focus:border-prism-sky/50 placeholder:text-white/20"
                                        />
                                        <p className="text-[10px] text-prism-muted mt-2">Set via environment variables. UI changes require server restart.</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
