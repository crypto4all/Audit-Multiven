module.exports = {
  solc: {
    optimizer: {
      enabled: true,
      runs: 500
    },

    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.gasEstimates']
      }
    },
  },

  mocha: {
    useColors: true,
    ui: 'bdd',
  },

  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },
     ropsten:  {
     network_id: 3,
     host: "localhost",
     port:  8545,
     gas:   2900000
    }
  },
   rpc: {
        host: 'localhost',
        post:8080
   }
};
