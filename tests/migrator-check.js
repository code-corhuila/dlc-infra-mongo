// The migration identity manages the clinical database only: it creates
// collections, validators, indexes and domain roles there, and nothing else.
load("/scripts/identities.js");

const clinical = db.getSiblingDB("clinical");
clinical.auth("clinical_migrator", secret("DLC_CLINICAL_MIGRATOR_PASSWORD_FILE"));

clinical.createCollection("migrator_check", { validator: { $jsonSchema: { bsonType: "object" } } });
clinical.migrator_check.createIndex({ checkedAt: 1 }, { name: "idx_migrator_check" });
clinical.runCommand({ collMod: "migrator_check", validationLevel: "strict" });
clinical.createRole({ role: "migrator_check_role", privileges: [{ resource: { db: "clinical", collection: "migrator_check" }, actions: ["find"] }], roles: [] });
clinical.dropRole("migrator_check_role");
clinical.migrator_check.drop();

function expectDenied(what, fn) {
  try {
    fn();
  } catch (e) {
    if (e.codeName === "Unauthorized") return;
    throw new Error(what + ": expected Unauthorized, got " + e.codeName);
  }
  throw new Error(what + " was allowed");
}

expectDenied("write to another database", () => db.getSiblingDB("other_context").probe.insertOne({ x: 1 }));
expectDenied("create a user in admin", () => db.getSiblingDB("admin").createUser({ user: "intruder", pwd: "intruder-password-123", roles: [] }));
expectDenied("list every database", () => db.adminCommand({ listDatabases: 1, nameOnly: false, authorizedDatabases: false }));
expectDenied("reconfigure the replica set", () => db.adminCommand({ replSetGetConfig: 1 }));
