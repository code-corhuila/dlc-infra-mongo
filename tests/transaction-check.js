// Synthetic multi-document transaction across two collections: a commit
// keeps both writes, an abort keeps neither. Uses its own throwaway database,
// as the engine administrator.
load("/scripts/identities.js");
authenticateRoot();

const name = "infra_transaction_check";
db.getSiblingDB(name).dropDatabase();

function inTransaction(fn, commit) {
  const session = db.getMongo().startSession();
  const tx = session.getDatabase(name);
  session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  fn(tx);
  if (commit) session.commitTransaction();
  else session.abortTransaction();
  session.endSession();
}

const check = db.getSiblingDB(name);
check.createCollection("state");
check.createCollection("outbox");

inTransaction((tx) => {
  tx.state.insertOne({ _id: "committed" });
  tx.outbox.insertOne({ _id: "committed-event" });
}, true);
inTransaction((tx) => {
  tx.state.insertOne({ _id: "aborted" });
  tx.outbox.insertOne({ _id: "aborted-event" });
}, false);

const state = check.state.countDocuments({ _id: "committed" }) + check.outbox.countDocuments({ _id: "committed-event" });
const leaked = check.state.countDocuments({ _id: "aborted" }) + check.outbox.countDocuments({ _id: "aborted-event" });
check.dropDatabase();
if (state !== 2) throw new Error("committed transaction lost a write");
if (leaked !== 0) throw new Error("aborted transaction left a write");
