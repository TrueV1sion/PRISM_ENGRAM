/**
 * Settings Types & Defaults — Client-safe module.
 * 
 * Contains only types and constants (no Prisma import).
 * Safe to import from "use client" components.
 */

export interface SettingsState {
    primaryModel: string;
    fallbackModel: string;
    temperature: number;
    maxTokens: number;
    blueprintGateEnabled: boolean;
    blueprintAutoApproveThreshold: number;
    findingsGateEnabled: boolean;
    findingsAutoApproveThreshold: number;
    synthesisGateEnabled: boolean;
    synthesisAutoApproveThreshold: number;
    defaultUrgency: "speed" | "balanced" | "thorough";
    maxAgents: number;
    enableMemoryBus: boolean;
    enableCriticPass: boolean;
    enabledSkills: string[];
}

export const DEFAULT_SETTINGS: SettingsState = {
    primaryModel: "claude-sonnet-4-6",
    fallbackModel: "gpt-4o",
    temperature: 0.3,
    maxTokens: 8192,
    blueprintGateEnabled: false,
    blueprintAutoApproveThreshold: 70,
    findingsGateEnabled: true,
    findingsAutoApproveThreshold: 60,
    synthesisGateEnabled: true,
    synthesisAutoApproveThreshold: 85,
    defaultUrgency: "balanced",
    maxAgents: 8,
    enableMemoryBus: true,
    enableCriticPass: true,
    enabledSkills: [
        "healthcare-quality-analytics",
        "payer-financial-modeling",
        "regulatory-intelligence",
        "competitive-landscape",
        "ma-market-dynamics",
        "political-influence-mapping",
    ],
};
