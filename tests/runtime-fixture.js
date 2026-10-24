// Test-only stand-in for the dlc-clinical-db roles: same names, one synthetic
// collection. The real roles and collections are created by dlc-clinical-db.
load("/scripts/identities.js");
authenticateRoot();

const clinical = db.getSiblingDB("clinical");
clinical.createCollection("runtime_check");
const crud = (actions) => [{ resource: { db: "clinical", collection: "runtime_check" }, actions: actions }];
clinical.createRole({ role: "clinical_application", privileges: crud(["find", "insert", "update"]), roles: [] });
clinical.createRole({ role: "clinical_outbox_publisher", privileges: crud(["find", "update"]), roles: [] });
clinical.createRole({ role: "clinical_inbox_consumer", privileges: crud(["find", "insert", "update"]), roles: [] });
clinical.createRole({ role: "clinical_analytics_projector", privileges: crud(["find", "insert", "update"]), roles: [] });
