// Initializes the single-member Clinical replica set and waits for a writable
// primary. Idempotent: an already initialized set is left unchanged.
const host = process.env.DLC_MONGO_HOST;
const setName = process.env.DLC_MONGO_REPLICA_SET;
if (!host || !setName) {
  throw new Error("DLC_MONGO_HOST and DLC_MONGO_REPLICA_SET are required");
}

function waitFor(condition, what, seconds) {
  for (let i = 0; i < seconds; i++) {
    try {
      if (condition()) return;
    } catch (e) {
      // The server may still be starting; retry until the deadline.
    }
    sleep(1000);
  }
  throw new Error("timed out waiting for " + what);
}

waitFor(() => db.adminCommand({ ping: 1 }).ok === 1, "mongod", 60);

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
