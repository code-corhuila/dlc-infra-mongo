// The runtime identity uses Clinical data through its roles and never manages
// collections, indexes, validators, roles or users (ADR-009).
load("/scripts/identities.js");

const clinical = db.getSiblingDB("clinical");
clinical.auth("clinical_runtime", secret("DLC_CLINICAL_RUNTIME_PASSWORD_FILE"));

clinical.runtime_check.insertOne({ _id: "runtime-1" });
clinical.runtime_check.updateOne({ _id: "runtime-1" }, { $set: { seen: true } });
if (clinical.runtime_check.countDocuments({ seen: true }) !== 1) throw new Error("runtime identity could not use Clinical data");

function expectDenied(what, fn) {
  try {
    fn();
  } catch (e) {
    if (e.codeName === "Unauthorized") return;
    throw new Error(what + ": expected Unauthorized, got " + e.codeName);
  }
  throw new Error(what + " was allowed");
}

expectDenied("create a collection", () => clinical.createCollection("runtime_ddl"));
expectDenied("create an index", () => clinical.runtime_check.createIndex({ seen: 1 }));
expectDenied("change a validator", () => clinical.runCommand({ collMod: "runtime_check", validator: {} }));
expectDenied("drop a collection", () => clinical.runCommand({ drop: "runtime_check" }));
expectDenied("delete Clinical data", () => clinical.runtime_check.deleteOne({ _id: "runtime-1" }));
expectDenied("create a role", () => clinical.createRole({ role: "runtime_extra", privileges: [], roles: [] }));
expectDenied("create a user", () => clinical.createUser({ user: "runtime_extra", pwd: "runtime-extra-password", roles: [] }));
expectDenied("read another database", () => db.getSiblingDB("other_context").probe.findOne());
