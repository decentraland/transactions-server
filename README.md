# Transactions Server

[![Coverage Status](https://coveralls.io/repos/github/decentraland/transactions-server/badge.svg?branch=main)](https://coveralls.io/github/decentraland/transactions-server?branch=main)

A server to relay meta-transactions for the Decentraland ecosystem, enabling users to interact with blockchain services without directly paying gas fees.

## Table of Contents

- [Features](#features)
- [Dependencies & Related Services](#dependencies--related-services)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the Service](#running-the-service)
- [Testing](#testing)
- [AI Agent Context](#ai-agent-context)
- [License](#license)

## Features

- **Meta-Transaction Relaying**: Relays meta-transactions to the blockchain, allowing users to interact without paying gas fees directly
- **Transaction Tracking**: Stores and retrieves user transaction history by address
- **Transaction Validation**: Validates transaction data and Ethereum addresses before processing

## Dependencies & Related Services

This service interacts with the following services or resources:

- **[Gelato](https://www.gelato.network/)**: Meta-transaction relay provider
- **PostgreSQL**: Database for storing transaction history
- **TheGraph**: For querying blockchain data
- **Ethereum RPC**: For blockchain interactions and contract calls

## API Documentation

The API is fully documented using the [OpenAPI standard](https://swagger.io/specification/). The schema is located at [docs/openapi.yaml](docs/openapi.yaml).

## Database Schema

See [docs/database-schemas.md](docs/database-schemas.md) for detailed schema, column definitions, and relationships.

## Getting Started

### Prerequisites

Before running this service, ensure you have the following installed:

- **Node.js**: Version 20.x or higher
- **npm**: Version 9.x or higher
- **Docker & Docker Compose**: For running the PostgreSQL database (recommended)
- **PostgreSQL**: Version 12 or higher (if not using Docker)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/decentraland/transactions-server.git
cd transactions-server
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

### Configuration

The service uses environment variables for configuration.
Create a `.env` file in the root directory containing the environment variables for the service to run.
Use the `.env.default` file as a reference for the required variables.

### Running the Service

#### Step 1: Start the Database

Start the PostgreSQL database using Docker Compose:

```bash
docker-compose up -d
```

This will start a PostgreSQL container with the following configuration:

- **Database**: `transactions_db`
- **User**: `transactions`
- **Password**: `transactions`
- **Port**: `5432` (accessible on localhost)

To verify the database is running:

```bash
docker-compose logs postgres
```

#### Step 2: Configure Environment Variables

Update your `.env` file with the database connection string:

```
PG_COMPONENT_PSQL_CONNECTION_STRING=postgres://transactions:transactions@localhost:5432/transactions_db
```

Make sure to set any required API keys (e.g., `GELATO_API_KEY`) if needed. See `.env.defaults` for all available configuration options.

#### Step 3: Initialize the Database

Run database migrations to create the required tables:

```bash
npm run migrate
```

#### Step 4: Run the Application Locally

**For development with hot-reload:**

```bash
npm run start:watch
```

**For production mode:**

```bash
npm start
```

## Testing

This service includes comprehensive test coverage with both unit and integration tests.

### Running Tests

Run all tests with coverage:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Test Structure

- **Unit Tests** (`test/tests/logic/`): Test individual components and functions in isolation
- **Integration Tests** (`test/tests/ports/`): Test external service integrations and complete request/response cycles

For detailed testing guidelines and standards, refer to our [Testing Standards](https://github.com/decentraland/docs/tree/main/development-standards/testing-standards) documentation.

## AI Agent Context

For detailed AI Agent context, see [docs/ai-agent-context.md](docs/ai-agent-context.md).

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE.txt](LICENSE.txt) file for details.
