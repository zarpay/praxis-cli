import type { CommandRegistrar } from "@framework/types.js";

import reportCalibrationStatusOrchestrator from "@/orchestrators/report-calibration-status-orchestrator.js";
import runCalibrationOrchestrator from "@/orchestrators/run-calibration-orchestrator.js";

/**
 * Registers the `praxis calibrate` command group.
 *
 * Calibration measures the reviewers against frozen, human-adjudicated
 * cases (06) — the only ground truth behind every conformance number.
 * `run` spends reviewer calls and writes ledger records; `status` is a
 * pure read.
 */
const calibrateCommand: CommandRegistrar = (program) => {
  const calibrate = program
    .command("calibrate")
    .description("Measure the reviewers against frozen, human-adjudicated cases");

  calibrate
    .command("run")
    .description("Review every case with the current reviewers; write calibration records")
    .option("--reviewer <name>", "calibrate only the named reviewer (default: all configured)")
    .option("--repeat <n>", "full-set passes; above 1 measures per-axiom variance", "1")
    .addHelpText(
      "after",
      `
When to use: after authoring or re-adjudicating cases, and after any
reviewer-affecting change (model swap, prompt edit) — before trusting
new numbers (06's drift protocol). Bypasses the verdict cache: every
case is a fresh, paid reviewer call.

Example:
  $ praxis calibrate run --reviewer v32 --repeat 3`,
    )
    .action(runCalibrationOrchestrator);

  calibrate
    .command("status")
    .description("Each reviewer's interpretability state: calibrated, stale, or absent")
    .option("--json", "machine-readable output (stable contract)")
    .addHelpText(
      "after",
      `
When to use: to see whether the numbers are interpretable — stale means
the reviewer, the case set, or a governed spec changed under the last
calibration. Free: reads the ledger and disk only.

Example:
  $ praxis calibrate status`,
    )
    .action(reportCalibrationStatusOrchestrator);
};

export default calibrateCommand;
