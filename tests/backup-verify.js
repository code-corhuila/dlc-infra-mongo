// After a restore the clinical database must match the backed-up state.
load("/scripts/identities.js");
authenticateRoot();
const clinical = db.getSiblingDB("clinical");

if (clinical.backup_check.countDocuments({}) !== 3) throw new Error("documents were not restored");
if (!clinical.backup_check.getIndexes().some((i) => i.name === "idx_backup_check_n" && i.unique)) throw new Error("the index was not restored");
const options = clinical.getCollectionInfos({ name: "backup_check" })[0].options;
if (!options.validator || options.validationLevel !== "strict") throw new Error("the validator was not restored");
try {
  clinical.backup_check.insertOne({ _id: "doc-x", n: "not an int" });
  throw new Error("the restored validator accepted an invalid document");
} catch (e) {
  if (e.code !== 121) throw e;
}
if (clinical.databasechangelog_clinical.countDocuments({ author: "dlc-clinical" }) !== 1) throw new Error("the Liquibase history was not restored");
