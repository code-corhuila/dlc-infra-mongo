// Synthetic stand-in for a migrated Clinical database: a validated collection
// with an index and documents, plus a Liquibase history entry.
load("/scripts/identities.js");
const clinical = db.getSiblingDB("clinical");
clinical.auth("clinical_migrator", secret("DLC_CLINICAL_MIGRATOR_PASSWORD_FILE"));

clinical.createCollection("backup_check", {
  validator: { $jsonSchema: { bsonType: "object", required: ["_id", "n"], properties: { n: { bsonType: "int" } } } },
  validationLevel: "strict",
  validationAction: "error",
});
clinical.backup_check.createIndex({ n: 1 }, { name: "idx_backup_check_n", unique: true });
clinical.backup_check.insertMany([1, 2, 3].map((n) => ({ _id: "doc-" + n, n: NumberInt(n) })));
clinical.databasechangelog_clinical.insertOne({ _id: "clinical-check", id: "clinical-check", author: "dlc-clinical", filename: "changelog/changelog-master.yaml" });

// The backup identity can read, and only read.
const backup = db.getMongo().getDB("clinical");
backup.logout();
backup.auth("clinical_backup", secret("DLC_CLINICAL_BACKUP_PASSWORD_FILE"));
try {
  backup.backup_check.insertOne({ _id: "doc-9", n: NumberInt(9) });
  throw new Error("the backup identity could write");
} catch (e) {
  if (e.codeName !== "Unauthorized") throw e;
}
