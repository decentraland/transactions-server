export const MetaTxForwarder = [
  { inputs: [], stateMutability: 'nonpayable', type: 'constructor' },
  {
    inputs: [
      { internalType: 'address', name: '_target', type: 'address' },
      { internalType: 'bytes', name: '_data', type: 'bytes' },
    ],
    name: 'forwardMetaTx',
    outputs: [{ internalType: 'bytes', name: '', type: 'bytes' }],
    stateMutability: 'payable',
    type: 'function',
  },
]
