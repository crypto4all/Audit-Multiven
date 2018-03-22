const assert = require('assert')
const {assertReverts, assertLog, assertEq} = require('./lib')

const BigNumber = require('bignumber.js')

const Multicoin = artifacts.require('Multicoin')
const MultivenIco = artifacts.require('MultivenIco')
const KycRegistry = artifacts.require('KycRegistry')

const Web3Utils = require('web3-utils')
const pricePerToken = Web3Utils.toWei('0.01', 'ether')
const decimalPrecision = new BigNumber(10).pow(18)

contract('MultivenIco', ([oracle, admin, multivenWallet, user1, user2, user3, user4, user5, user6, user7]) => {
  let multicoin
  let multivenIco
  let kycRegistry

  async function setupContracts() {
    const kycRegistry = await KycRegistry.new(oracle)
    const multicoin = await Multicoin.new({from: admin})
    const multivenIco = await MultivenIco.new(
      kycRegistry.address,
      multicoin.address,
      multivenWallet,
      7000,
      2000,
      1500,
      3000, // Low supply to make test easier
      {from: admin}
    )

    return {kycRegistry, multivenIco, multicoin}
  }

  beforeEach('redeploy', async function () {
    const contracts = await setupContracts()
    kycRegistry = contracts.kycRegistry
    multivenIco = contracts.multivenIco
    multicoin = contracts.multicoin

    await multicoin.distributeSupply(multivenIco.address, new BigNumber('15875'), {from: admin})
    await multicoin.allowFreezeBypass(multivenIco.address, {from: admin})
    await kycRegistry.kycStatusSet(user1, true, {from: oracle})
  })

  it('rejects the contribution if on Ico Round 0', async function() {
    assertEq(await multivenIco.currentIcoRound(), 0)

    await assertReverts(
      multivenIco.sendTransaction( { from: user1, value: Web3Utils.toWei('1', 'ether') } )
    )
  })

  it('rejects goToNextRound() calls if it is not the owner', async function() {
    await assertReverts(
      multivenIco.goToNextRound({from: user1})
    )
  })

  it('accepts goToNextRound() calls if it is the owner', async function () {
    await multivenIco.goToNextRound({from: admin})
    assertEq(await multivenIco.currentIcoRound(), 1)
  })

  it('rejects a contribution made below the limit for a given round', async function () {
    const paymentAmount = Web3Utils.toWei('0.001', 'ether')
    await multivenIco.goToNextRound({from: admin})
    assertEq(await multivenIco.currentIcoRound(), 1)

    await assertReverts(
      multivenIco.sendTransaction( { from: user1, value: paymentAmount } )
    )

    assertEq(await multicoin.balanceOf(user1), 0)
  })

  it('rejects a contribution if it goes behind the remaining supply of the round', async function() {
    const paymentAmount = Web3Utils.toWei('71', 'ether')
    await multivenIco.goToNextRound({from: admin})
    assertEq(await multivenIco.currentIcoRound(), 1)

    await assertReverts(
      multivenIco.sendTransaction({ from: user1, value: paymentAmount })
    )
  })

  it('goes to next round automaticaly at the end of the supply', async function() {
    const paymentAmount = Web3Utils.toWei('70', 'ether')
    await kycRegistry.kycStatusSet(user2, true, {from: oracle})
    await multivenIco.goToNextRound({from: admin})
    assertEq(await multivenIco.currentIcoRound(), 1)
    await multivenIco.sendTransaction({ from: user2, value: paymentAmount })
    assertEq(await multivenIco.currentIcoRound(), 2)
  })

  it('rejects a contribution from a non-cleared address', async function () {
    const paymentAmount = Web3Utils.toWei('0.001', 'ether')
    await multivenIco.goToNextRound({from: admin})
    assertEq(await multivenIco.currentIcoRound(), 1)
    assertEq(await kycRegistry.isAddressCleared(user2), false)

    await assertReverts(
      multivenIco.sendTransaction( { from: user2, value: paymentAmount } )
    )

    assertEq(await multicoin.balanceOf(user1), 0)
  })

  it('gives the right amount of token on round 1', async function () {
    const paymentAmount = Web3Utils.toWei('1', 'ether')
    const tokenAmount = new BigNumber(paymentAmount).dividedBy(pricePerToken).times('1.25').mul(decimalPrecision)

    await multivenIco.goToNextRound({from: admin})
    assertEq(await multivenIco.currentIcoRound(), 1)
    assertEq(await multicoin.balanceOf(user1), 0)

    await multivenIco.sendTransaction( { from: user1, value: paymentAmount } )
    assertEq(await multicoin.balanceOf(user1), tokenAmount)
  })

  it('gives the right amount of token on round 2', async function () {
    const paymentAmount = Web3Utils.toWei('1', 'ether')
    const tokenAmount = new BigNumber(paymentAmount).dividedBy(pricePerToken).times('1.20').mul(decimalPrecision)

    await multivenIco.goToNextRound({from: admin})
    await multivenIco.goToNextRound({from: admin})
    assertEq(await multivenIco.currentIcoRound(), 2)
    assertEq(await multicoin.balanceOf(user1), 0)

    await multivenIco.sendTransaction( { from: user1, value: paymentAmount } )
    assertEq(await multicoin.balanceOf(user1), tokenAmount)
  })

  it('gives the right amount of token on round 3', async function () {
    const paymentAmount = Web3Utils.toWei('1', 'ether')
    const tokenAmount = new BigNumber(paymentAmount).dividedBy(pricePerToken).times('1.15').mul(decimalPrecision)

    await multivenIco.goToNextRound({from: admin})
    await multivenIco.goToNextRound({from: admin})
    await multivenIco.goToNextRound({from: admin})
    assertEq(await multivenIco.currentIcoRound(), 3)
    assertEq(await multicoin.balanceOf(user1), 0)

    await multivenIco.sendTransaction( { from: user1, value: paymentAmount } )
    assertEq(await multicoin.balanceOf(user1), tokenAmount)
  })

  it('gives the right amount of token on round 4', async function () {
    const paymentAmount = Web3Utils.toWei('1', 'ether')
    const tokenAmount = new BigNumber(paymentAmount).dividedBy(pricePerToken).mul(decimalPrecision)

    await multivenIco.goToNextRound({from: admin})
    await multivenIco.goToNextRound({from: admin})
    await multivenIco.goToNextRound({from: admin})
    await multivenIco.goToNextRound({from: admin})
    assertEq(await multivenIco.currentIcoRound(), 4)
    assertEq(await multicoin.balanceOf(user1), 0)

    await multivenIco.sendTransaction( { from: user1, value: paymentAmount } )
    assertEq(await multicoin.balanceOf(user1), tokenAmount)
  })

  it('reports supply correctly between rounds', async function () {
    const paymentAmount = Web3Utils.toWei('30', 'ether')

    await multivenIco.goToNextRound({from: admin})

    assertEq(await multivenIco.currentIcoRound(), 1)
    await multivenIco.sendTransaction( { from: user1, value: paymentAmount } )
    let prevDistributionInfo = await multivenIco.distributionInfo()

    await multivenIco.goToNextRound({from: admin})
    assertEq(await multivenIco.currentIcoRound(), 2)
    let nextDistributionInfo = await multivenIco.distributionInfo()

    const defaultRound2DistributionSupply = new BigNumber('2000').mul(decimalPrecision)
    assertEq(defaultRound2DistributionSupply.add(prevDistributionInfo[4]), nextDistributionInfo[4])
  })

  it('gives back the remaining token supply after round 4', async function () {
    const paymentAmount = Web3Utils.toWei('1', 'ether')
    const tokenAmount = new BigNumber(paymentAmount).dividedBy(pricePerToken).mul(decimalPrecision)

    await multivenIco.goToNextRound({from: admin})
    await multivenIco.goToNextRound({from: admin})
    await multivenIco.goToNextRound({from: admin})
    await multivenIco.goToNextRound({from: admin})
    assertEq(await multivenIco.currentIcoRound(), 4)
    await multivenIco.sendTransaction( { from: user1, value: paymentAmount } )
    let remainingSupply = new BigNumber('15875').mul(decimalPrecision).sub(tokenAmount)

    assertLog(await multivenIco.goToNextRound({from: admin}), 'RemainingTokensSent', {
      tokenSent: remainingSupply
    })

    assertEq(await multicoin.balanceOf(multivenWallet), remainingSupply)
    assertEq(await multivenIco.currentIcoRound(), 5)
  })

  it('gives back the remaining token supply after round 4 close automatically', async function () {
    const endRound1PaymentAmount = Web3Utils.toWei('70', 'ether')
    const paymentAmountA = Web3Utils.toWei('25', 'ether')
    const paymentAmountB = Web3Utils.toWei('15', 'ether')

    // User that will finish round 1
    await kycRegistry.kycStatusSet(user4, true, {from: oracle})

    // Users that will finish round 4
    await kycRegistry.kycStatusSet(user5, true, {from: oracle})
    await kycRegistry.kycStatusSet(user6, true, {from: oracle})
    await kycRegistry.kycStatusSet(user7, true, {from: oracle})

    // Go to round 1
    await multivenIco.goToNextRound({from: admin})

    // Go to round 2 by exhausting round 1 supply
    await multivenIco.sendTransaction({from: user4, value: endRound1PaymentAmount})
    assertEq(await multivenIco.currentIcoRound(), 2)

    // Go to round 3
    await multivenIco.goToNextRound({from: admin})

    // Go to round 4
    await multivenIco.goToNextRound({from: admin})
    assertEq(await multivenIco.currentIcoRound(), 4)

    // remaining supplies
    await multivenIco.sendTransaction({from: user5, value: paymentAmountA})
    await multivenIco.sendTransaction({from: user6, value: paymentAmountA})
    let remainingSupply = new BigNumber(await multicoin.balanceOf(multivenIco.address))
                              .sub(new BigNumber(paymentAmountB).dividedBy(pricePerToken).mul(decimalPrecision))
    assertLog(await multivenIco.sendTransaction({from: user7, value: paymentAmountB}), 'RemainingTokensSent', {
      tokenSent: remainingSupply
    })
    assertEq(await multicoin.balanceOf(multivenWallet), remainingSupply)
    assertEq(await multivenIco.currentIcoRound(), 5)
  })

  it('rejects goToNextRound() if already on final round', async function() {
    await multivenIco.goToNextRound({from: admin}) // 0 -> 1 : Go to Round 1
    await multivenIco.goToNextRound({from: admin}) // 1 -> 2 : Go to Round 2
    await multivenIco.goToNextRound({from: admin}) // 2 -> 3 : Go to Round 3
    await multivenIco.goToNextRound({from: admin}) // 3 -> 4.: Go to Round 4
    await multivenIco.goToNextRound({from: admin}) // 4 -> 5 : Final
    await assertReverts(
      multivenIco.goToNextRound({from: admin})
    )
  })
})