// Initializes the single-member Clinical replica set, waits for a writable
// primary and ensures the Clinical migration identity. Idempotent.
load("/scripts/identities.js");

const host = required("DLC_MONGO_HOST");
const setName = required("DLC_MONGO_REPLICA_SET");

waitFor(() => db.adminCommand({ ping: 1 }).ok === 1, "mongod", 60);
authenticateRoot();

let initialized = true;
try {
  const status = rs.status();
  if (status.set !== setName) {
    throw new Error("member belongs to replica set " + status.set + ", expected " + setName);
  }
} catch (e) {
  if (e.codeName !== "NotYetInitialized") throw e;
  initialized = false;
}
if (!initialized) {
  rs.initiate({ _id: setName, members: [{ _id: 0, host: host }] });
  print("replica set " + setName + " initiated with " + host);
} else {
  print("replica set " + setName + " already initialized");
}
waitFor(() => db.hello().isWritablePrimary === true, "a writable primary", 60);
print("primary ready: " + db.hello().primary);

// dlc-clinical-db runs Liquibase with this identity: collections, validators,
// indexes, domain roles and its changelog, on the clinical database only (ADR-009).
ensureUser("clinical", "clinical_migrator", "DLC_CLINICAL_MIGRATOR_PASSWORD_FILE", [
  { role: "dbAdmin", db: "clinical" },
  { role: "readWrite", db: "clinical" },
  { role: "userAdmin", db: "clinical" },
]);
