--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------

CREATE TABLE transactions (
  id   INTEGER PRIMARY KEY,
  txHash TEXT,
  userAddress: TEXT NOT NULL
  contractAddress: TEXT NOT NULL
  ip: TEXT NOT NULL
  createdAt: DATE NOT NULL DEFAULT DATE('now')
);

--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------

DROP INDEX transactions;