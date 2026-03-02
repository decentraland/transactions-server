# AI Agent Context

**Service Purpose:**

The Transactions Server is a meta-transaction relay service for the Decentraland ecosystem. It allows users to interact with blockchain smart contracts without directly paying gas fees, improving user experience and onboarding by removing the need to own cryptocurrency for transaction fees.

**Key Capabilities:**

- **Meta-Transaction Relay**: Accepts transaction data from users and relays it to the blockchain through Gelato
- **Transaction History**: Stores and retrieves transaction history by user address
- **Multi-Provider Support**: Integrates with multiple meta-transaction providers for redundancy and optimal gas pricing
- **Transaction Validation**: Validates Ethereum addresses and transaction data before processing
- **Gas Price Monitoring**: Fetches and monitors network gas prices across different blockchain networks

**Communication Pattern:**

HTTP REST API using the well-known-components architecture pattern

**Technology Stack:**

- **Runtime**: Node.js (v20.x+)
- **Language**: TypeScript
- **HTTP Framework**: @well-known-components/http-server
- **Database ORM**: @well-known-components/pg-component
- **Migration Tool**: node-pg-migrate
- **Testing**: Jest
- **Blockchain Library**: ethers.js v5
- **Schema Validation**: ajv, @dcl/schemas

**External Dependencies:**

- **Database**: PostgreSQL (transaction history storage)
- **Biconomy**: Meta-transaction relay provider
- **Gelato**: Decentralized transaction automation and relay
- **Tenderly**: Transaction simulation and relay platform
- **TheGraph**: Blockchain data indexing and querying
- **Ethereum RPC**: For contract interactions and transaction submission

**Key Concepts:**

- **Meta-Transaction**: A transaction where the gas fee is paid by a third party (the relayer) while the transaction itself is signed by the user. This allows users to interact with smart contracts without owning ETH for gas.
- **Transaction Hash**: Each relayed transaction receives a unique transaction hash (txHash) that can be used to track the transaction on the blockchain.
- **User Address**: Ethereum addresses are normalized to lowercase before storage to ensure consistency in queries and data integrity.
- **Transaction Data**: Consists of the user's address (`from`), the target contract address (`manaAddress`), and the encoded transaction data (`txData`).
- **Relayer Providers**: The service supports multiple relayer providers (Biconomy, Gelato, Tenderly) and can be configured to use different providers based on network conditions and availability.

**Database notes:**

- **Transaction Storage**: All relayed transactions are stored with their hash, user address, and timestamp for historical tracking and analytics.
- **Address Normalization**: User addresses are always stored in lowercase to prevent duplicate entries due to case sensitivity.
- **Primary Key**: The `id` field is an auto-incrementing serial used as the primary key, while `tx_hash` must be unique across all transactions.
