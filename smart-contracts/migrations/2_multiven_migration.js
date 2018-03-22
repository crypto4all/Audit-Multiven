const Migrations = artifacts.require('./Migrations.sol')
const MultivenIco = artifacts.require('./MultivenIco.sol')
const Multicoin = artifacts.require('./Multicoin.sol')

const kycRegistry = process.env.KYC_REGISTRY_ADDRESS
const multivenWallet = process.env.MULTIVEN_WALLET_ADDRESS

module.exports = async function(deployer, network) {
  let multivenIco, multicoin

  deployer.then(function() {
    // Deplying Multicoin
    return Multicoin.new()
  }).then(function(instance){
    multicoin = instance
    // Deploying MultivenIco contract
    return MultivenIco.new(
      kycRegistry,
      multicoin.address,
      multivenWallet,
      30000000,
      40000000,
      60000000,
      70000000
    )
  }).then(function(instance){
    multivenIco = instance
    // Distribute ICO supply to MultivenICO contract
    return multicoin.distributeSupply(multivenIco.address, '240000000')
  }).then(function() {
    // Allow contract to bypass current freeze
    return multicoin.allowFreezeBypass(multivenIco.address)
  })
}
