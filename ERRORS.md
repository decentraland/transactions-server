# Common Biconomy error responses

### code=UNPREDICTABLE_GAS_LIMIT:

```
{"timestamp":"{timestamp}","kind":"ERROR","system":"transactions-server","message":"Error: An error occurred trying to send the meta transaction. Response: {\"log\":\"Error while gas estimation with message cannot estimate gas; transaction may fail or may require manual gas limit [...] \\\\\\\"id\\\\\\\":{id},\\\\\\\"jsonrpc\\\\\\\":\\\\\\\"2.0\\\\\\\"}\\\",\\\"requestMethod\\\":\\\"POST\\\",\\\"url\\\":\\\"https://rpc-biconomy-mainnet.maticvigil.com/v1/{key}\\\"}, method=\\\"estimateGas\\\", transaction={\\\"from\\\":\\\"{{from}}\\\",\\\"to\\\":\\\"{to}\\\",\\\"data\\\":\\\"{data}\\\", code=UNPREDICTABLE_GAS_LIMIT, version=providers/5.4.0)\",\"flag\":417,\"code\":417}.\n
```
