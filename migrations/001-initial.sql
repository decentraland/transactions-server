--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  txHash TEXT NOT NULL UNIQUE,
  userAddress TEXT NOT NULL,
  createdAt DATE DEFAULT (datetime('now', 'localtime'))
);


--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------

DROP TABLE transactions;