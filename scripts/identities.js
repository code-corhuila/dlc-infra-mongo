// Shared helpers of the initialization scripts, loaded with load() so they run
// in the shell context. Secrets are read from mounted files and never printed.
const fs = require("fs");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + " is required");
  return value;
}

function secret(fileVariable) {
  const value = fs.readFileSync(required(fileVariable), "utf8").trim();
  if (value.length < 16) throw new Error(fileVariable + " must hold at least 16 characters");
  return value;
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

function authenticateRoot() {
  db.getSiblingDB("admin").auth(required("DLC_MONGO_ROOT_USER"), secret("DLC_MONGO_ROOT_PASSWORD_FILE"));
}

// ensureUser creates the identity, or re-applies its password and exact roles,
// so a rotated secret or a removed grant is corrected on the next run.
function ensureUser(database, user, passwordFile, roles) {
  const target = db.getSiblingDB(database);
  const password = secret(passwordFile);
  if (target.getUser(user)) {
    target.updateUser(user, { pwd: password, roles: roles });
    print("identity " + user + "@" + database + " updated");
  } else {
    target.createUser({ user: user, pwd: password, roles: roles });
    print("identity " + user + "@" + database + " created");
  }
}
