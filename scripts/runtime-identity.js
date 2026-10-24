// Ensures the runtime identity of the Clinical processes (API, outbox relay,
// inbox consumer, intent reconciler, analytics consumer). Its roles are created by dlc-clinical-db,
// so run this after the migrations; it fails if any role is missing.
load("/scripts/identities.js");

const runtimeRoles = ["clinical_application", "clinical_outbox_publisher", "clinical_inbox_consumer", "clinical_analytics_projector"];

authenticateRoot();
const clinical = db.getSiblingDB("clinical");
const missing = runtimeRoles.filter((role) => !clinical.getRole(role));
if (missing.length) {
  throw new Error("dlc-clinical-db has not created the roles " + missing.join(", ") + "; run its migrations first");
}
ensureUser("clinical", "clinical_runtime", "DLC_CLINICAL_RUNTIME_PASSWORD_FILE", runtimeRoles.map((role) => ({ role: role, db: "clinical" })));
