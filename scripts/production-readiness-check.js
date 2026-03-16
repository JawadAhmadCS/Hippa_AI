import { buildProductionReadinessStatus } from "../src/services/production-readiness-service.js";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");

const status = buildProductionReadinessStatus();

console.log(`Production readiness score: ${status.summary.score}%`);
console.log(`Ready for production: ${status.readyForProduction ? "yes" : "no"}`);
console.log(`Blockers: ${status.summary.blockerCount}`);

if (status.blockers.length) {
  console.log("Open blockers:");
  for (const blocker of status.blockers) {
    console.log(`- ${blocker.label}${blocker.notes ? ` (${blocker.notes})` : ""}`);
  }
}

if (status.warnings.length) {
  console.log("Warnings:");
  for (const warning of status.warnings) {
    console.log(`- ${warning.label}${warning.notes ? ` (${warning.notes})` : ""}`);
  }
}

if (strict && status.summary.blockerCount > 0) {
  process.exitCode = 1;
}
