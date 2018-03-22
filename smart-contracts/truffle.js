require('dotenv').config()

const HDWalletProvider = require("truffle-hdwallet-provider");
const mnemonic = process.env.MNEMONIC

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
    rinkeby: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://rinkeby.infura.io")
      },
      network_id: 4
    }
  },
};
