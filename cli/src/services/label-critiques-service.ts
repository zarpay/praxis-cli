import type { PraxisConfig } from "@/models/praxis-config.js";
import type { PendingCritique, ProviderUsage, Service, TriageAssignmentRecord } from "@/types.js";

import { joinPath } from "@/helpers/paths-helper.js";
import curatorSystemPrompt from "@/prompts/curator-system-prompt.js";
import labelingAxiomBlock from "@/prompts/labeling-axiom-block.js";
import labelingCritiqueLine from "@/prompts/labeling-critique-line.js";
import labelingQuestion from "@/prompts/labeling-question.js";
import labelingTools from "@/prompts/labeling-tools.js";
import requestCuratorCompletionService from "@/services/request-curator-completion-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { TriageStore } from "@/stores/triage-store.js";

/** The pending backlog to label, and whether to write the outcome. */
interface LabelCritiquesInput {
  pending: PendingCritique[];
  /** Propose without writing anything. */
  dryRun?: boolean;
}

/** One proposed or written label. */
interface CritiqueLabel {
  critiqueId: string;
  axiomId: string;
  axiomVersion: number;
}

/** What the labeling pass did (or would do, under dryRun). */
interface LabelCritiquesResult {
  labels: CritiqueLabel[];
  /** Critiques the curator left unlabeled — the residue for curate. */
  leftPending: number;
  /** Critiques whose spec has no active axioms — nothing to label against. */
  skippedNoAxioms: number;
  usage: ProviderUsage | null;
  /** Where the assignment records landed; null under dryRun or when nothing was labeled. */
  sessionPath: string | null;
}

/** One wire entry of the labeling tool. */
interface WireLabel {
  critique_id: string;
  axiom_id: string | null;
}

/**
 * The labeling pass (04, review→label): batch-classifies the pending
 * backlog against each spec's active axioms — one curator call per
 * spec, temperature 0 — and appends matcher assignment records for the
 * squarely-an-instance matches. Everything else stays pending for the
 * human curate session.
 *
 * The hallucination guard lives here now: a returned axiom id that is
 * not among the spec's active axioms is discarded (the critique stays
 * pending), exactly as the review layer once discarded uncited ids —
 * an unratified id must never enter the ledger as an assignment.
 */
const labelCritiquesService: Service<LabelCritiquesInput, Promise<LabelCritiquesResult>> = async (
  cfg,
  { pending, dryRun = false },
) => {
  const axiomStore = new AxiomStore(cfg);
  const bySpec = new Map<string, PendingCritique[]>();

  for (const critique of pending) {
    const held = bySpec.get(critique.specPath) ?? [];
    held.push(critique);
    bySpec.set(critique.specPath, held);
  }

  const labels: CritiqueLabel[] = [];
  const usages: (ProviderUsage | null)[] = [];
  let skippedNoAxioms = 0;

  for (const [specPath, critiques] of bySpec) {
    const axioms = axiomStore.activeFor(joinPath(cfg.root, specPath));

    if (axioms.length === 0) {
      skippedNoAxioms += critiques.length;

      continue;
    }

    const axiomBlocks = axioms
      .map((axiom) =>
        labelingAxiomBlock({ id: axiom.id, severity: axiom.severity, body: axiom.body.trim() }),
      )
      .join("\n\n");
    const critiqueLines = critiques
      .map((critique) =>
        labelingCritiqueLine({
          id: critique.id,
          filePath: critique.filePath,
          text: critique.text,
        }),
      )
      .join("\n");
    const userPrompt = labelingQuestion({ specPath, axiomBlocks, critiqueLines });

    const completion = await requestCuratorCompletionService(cfg, {
      systemPrompt: curatorSystemPrompt(),
      userPrompt,
      tools: labelingTools(),
    });

    usages.push(completion.usage);

    const wire = (completion.args as { labels?: WireLabel[] }).labels ?? [];
    const versions = new Map(axioms.map((axiom) => [axiom.id, axiom.version]));
    const critiqueIds = new Set(critiques.map((critique) => critique.id));

    for (const entry of wire) {
      if (entry.axiom_id === null) continue;

      const version = versions.get(entry.axiom_id);

      if (version === undefined || !critiqueIds.has(entry.critique_id)) continue;

      labels.push({
        critiqueId: entry.critique_id,
        axiomId: entry.axiom_id,
        axiomVersion: version,
      });
    }
  }

  const sessionPath = dryRun || labels.length === 0 ? null : writeAssignments(cfg, labels);

  return {
    labels,
    leftPending: pending.length - labels.length,
    skippedNoAxioms,
    usage: sumUsage(usages),
    sessionPath,
  };
};

export default labelCritiquesService;

/** Lands the labels as one triage session of matcher assignments. */
function writeAssignments(cfg: PraxisConfig, labels: CritiqueLabel[]): string {
  const suggestedBy = cfg.curator?.model ?? "curator";
  const records: TriageAssignmentRecord[] = labels.map((label) => ({
    kind: "assignment",
    critique_id: label.critiqueId,
    axiom_id: label.axiomId,
    axiom_version: label.axiomVersion,
    assigned_by: { decision: "matcher", suggested_by: suggestedBy },
    timestamp: new Date().toISOString(),
  }));

  return new TriageStore(cfg).writeSession(records).path;
}

/** Usage summed across calls; null when nothing was reported. */
function sumUsage(usages: (ProviderUsage | null)[]): ProviderUsage | null {
  const reported = usages.filter((usage): usage is ProviderUsage => usage !== null);

  if (reported.length === 0) return null;

  return {
    promptTokens: total(reported.map((usage) => usage.promptTokens)),
    completionTokens: total(reported.map((usage) => usage.completionTokens)),
    costUsd: total(reported.map((usage) => usage.costUsd)),
  };
}

/** Sum of the reported values; null when none were reported. */
function total(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);

  if (known.length === 0) return null;

  return known.reduce((sum, value) => sum + value, 0);
}
