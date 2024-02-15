# Transactions Server

[![Coverage Status](https://coveralls.io/repos/github/decentraland/transactions-server/badge.svg?branch=main)](https://coveralls.io/github/decentraland/transactions-server?branch=main)

Server to relay meta-transactions.

## Set up

You'll need to check the `.env.defaults` file and create your own `.env` file. Some properties have defaults. Once you're done, you can run the project!

# Run the project

The server's only dependency is sqlite3 which needs to be initialized first.

```bash
npm install
npm run migrate
npm start # runs npm run build behind the scenes

# or

npm run start:watch # will watch for changes
```

# Endpoints

Check [`./src/adapters/routes.ts`](https://github.com/decentraland/transactions-server/blob/master/src/adapters/routes.ts) for an up to date list of all the endpoints. The most important ones are:

### POST /transactions

Relays a meta transaction. It accepts a body with the data. Check [`transactionSchema`](https://github.com/decentraland/transactions-server/blob/master/src/types/transaction.ts#L31) for an up to date version of the data you need to supply.

You can also check this [`Playground`](https://web3playground.io/Qmd2WcPpBwM3NqBHL7VU8edU1M64cg1Y7TAPB67yfwsmuH)

### GET /transactions/:userAddress

Returns the transactions an address relayed

# Test

```bash
npm run test

# or

npm run test:watch # will watch for changes
```

