const assert = require('assert')
const {assertReverts, assertLog, assertEq} = require('./lib')

const BigNumber = require('bignumber.js')

const Multicoin = artifacts.require('Multicoin')
const ApproveAndCallFallBackTest = artifacts.require('ApproveAndCallFallBackTest')

const decimalPrecision = new BigNumber(10).pow(18)

function tokenNumber(num) {
  return new BigNumber(num).mul(decimalPrecision)
}

contract('Multicoin', ([admin, user1, user2, user3, user4]) => {
  let multicoin

  async function setupContracts() {
    const multicoin = await Multicoin.new({from: admin})
    return {multicoin}
  }

  beforeEach('redeploy', async function () {
    const contracts = await setupContracts()
    multicoin = contracts.multicoin

    // User 1 : Has supply, has freeze bypass
    await multicoin.distributeSupply(user1, 2000, {from: admin})
    await multicoin.allowFreezeBypass(user1, {from: admin})
    // User 2 : Has supply, has not freeze bypass
    await multicoin.distributeSupply(user2, 2000, {from: admin})
    // User 3 : Has no supply, has freeze bypass
    await multicoin.allowFreezeBypass(user3, {from: admin})
    // User 4 : Has no supply, has no freeze bypass
    // No Tx : default state
  })

  it('sets the parameters correctly when admin calls distribution and freeze methods', async function() {
    assertEq(await multicoin.balanceOf(user1), tokenNumber(2000))
    assertEq(await multicoin.balanceOf(user2), tokenNumber(2000))
    assertEq(await multicoin.freezeBypassing(user1), true)
    assertEq(await multicoin.freezeBypassing(user3), true)
  })

  it('returns the right amount in the totalSupply() method', async function() {
    assertEq(await multicoin.totalSupply(), tokenNumber(2000000000))
  })

  it('refuses to give more token than the totalSupply', async function() {
    await assertReverts(
      multicoin.distributeSupply(user4, tokenNumber(2000000001), {from: admin})
    )
  })

  it('permits to a freeze-bypasser to send tokens', async function() {
    assertEq(await multicoin.tradingLive(), false)
    await multicoin.transfer(user4, tokenNumber(1000), {from: user1})
    assertEq(await multicoin.balanceOf(user1), tokenNumber(1000))
    assertEq(await multicoin.balanceOf(user4), tokenNumber(1000))
  })

  it('does not permit to a non-freeze-bypasser to send tokens if tradinf is not live', async function() {
    assertEq(await multicoin.tradingLive(), false)

    await assertReverts(
      multicoin.transfer(user4, tokenNumber(1000), {from: user2})
    )

    assertEq(await multicoin.balanceOf(user2), tokenNumber(2000))
    assertEq(await multicoin.balanceOf(user4), tokenNumber(0))
  })

  it('permits to a non-freeze-bypasser to send tokens if trading is live', async function() {
    await multicoin.setTradingLive({from: admin})
    assertEq(await multicoin.tradingLive(), true)

    assertLog(await multicoin.transfer(user4, tokenNumber(1000), {from: user2}), 'Transfer', {
      from: user2,
      to: user4,
      tokens: tokenNumber(1000)
    })

    assertEq(await multicoin.balanceOf(user2), tokenNumber(1000))
    assertEq(await multicoin.balanceOf(user4), tokenNumber(1000))
  })

  it('creates and returns approvals correctly', async function() {
    assertLog(await multicoin.approve(user4, tokenNumber(100), {from: user1}), 'Approval', {
      tokenOwner: user1,
      spender: user4,
      tokens: tokenNumber(100)
    })
    assertEq(await multicoin.allowance(user1, user4), tokenNumber(100))
  })

  it('creates an allowance and permit to spend the token, if trading is live', async function() {
    await multicoin.setTradingLive({from: admin})
    assertEq(await multicoin.tradingLive(), true)

    assertLog(await multicoin.approve(user4, tokenNumber(100), {from: user1}), 'Approval', {
      tokenOwner: user1,
      spender: user4,
      tokens: tokenNumber(100)
    })
    assertEq(await multicoin.allowance(user1, user4), tokenNumber(100))
    assertLog(await multicoin.transferFrom(user1, user3, tokenNumber(100), {from: user4}), 'Transfer', {
      from: user1,
      to: user3,
      tokens: tokenNumber(100)
    })
    assertEq(await multicoin.balanceOf(user3), tokenNumber(100))
  })

  it('creates an allowance and permit to spend the token, if trading is not live but tokenOwner is a freeze-bypasser', async function() {
    assertLog(await multicoin.approve(user4, tokenNumber(100), {from: user1}), 'Approval', {
      tokenOwner: user1,
      spender: user4,
      tokens: tokenNumber(100)
    })
    assertEq(await multicoin.allowance(user1, user4), tokenNumber(100))
    assertLog(await multicoin.transferFrom(user1, user3, tokenNumber(100), {from: user4}), 'Transfer', {
      from: user1,
      to: user3,
      tokens: tokenNumber(100)
    })
    assertEq(await multicoin.balanceOf(user3), tokenNumber(100))
  })

  it('handles token transfer approval to a contract', async function() {
    const destinationContract = await ApproveAndCallFallBackTest.new()
    const tokenAmount = tokenNumber(100)

    assertLog(await multicoin.approveAndCall(destinationContract.address, tokenAmount, 'Hello World !', {from: user1}), 'Approval', {
      tokenOwner: user1,
      spender: destinationContract.address,
      tokens: tokenAmount,
    })

    assertEq(await destinationContract.from(), user1)
    assertEq(await destinationContract.token(), multicoin.address)
    assertEq(await destinationContract.tokens(), tokenAmount)
    assertEq(await destinationContract.data(), web3.fromAscii('Hello World !'))
  })

  it('permits to withdraw any lost ERC20 token from the contract', async function() {
    otherMultiCoin = await Multicoin.new({from: admin})
    await otherMultiCoin.setTradingLive({from: admin})

    await otherMultiCoin.distributeSupply(multicoin.address, 100, {from: admin})
    assertEq(await otherMultiCoin.balanceOf(multicoin.address), tokenNumber(100))

    await multicoin.transferAnyERC20Token(otherMultiCoin.address, tokenNumber(100), {from: admin})
    assertEq(await otherMultiCoin.balanceOf(multicoin.address), 0)
    assertEq(await otherMultiCoin.balanceOf(admin), tokenNumber(100))
  })

  it('permits to transfert its ownership', async function() {
    assertEq(await multicoin.owner(), admin)
    await multicoin.transferOwnership(user4, {from: admin})
    assertEq(await multicoin.owner(), admin)
    await multicoin.acceptOwnership({from: user4})
    assertEq(await multicoin.owner(), user4)
  })

  it('checks if the new owner is allowed to accept it', async function() {
    assertEq(await multicoin.owner(), admin)
    await multicoin.transferOwnership(user4, {from: admin})
    assertEq(await multicoin.owner(), admin)
    await assertReverts(
      multicoin.acceptOwnership({from: user3})
    )
    assertEq(await multicoin.owner(), admin)
  })

  describe('transfer', function () {
    describe('when the recipient is not the zero address', function () {
      const to = user1;

      describe('when the sender does not have enough balance', function () {
        const amount = 101;

        it('reverts', async function () {
          await assertRevert(this.token.transfer(to, amount, { from: admin }));
        });
      });

      describe('when the sender has enough balance', function () {
        const amount = 100;

        it('transfers the requested amount', async function () {
          await this.token.transfer(to, amount, { from: admin });

          const senderBalance = await this.token.balanceOf(admin);
          assert.equal(senderBalance, 0);

          const recipientBalance = await this.token.balanceOf(to);
          assert.equal(recipientBalance, amount);
        });

        it('emits a transfer event', async function () {
          const { logs } = await this.token.transfer(to, amount, { from: admin });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Transfer');
          assert.equal(logs[0].args.from, admin);
          assert.equal(logs[0].args.to, to);
          assert(logs[0].args.value.eq(amount));
        });
      });
    });

    describe('when the recipient is the zero address', function () {
      const to = ZERO_ADDRESS;

      it('reverts', async function () {
        await assertRevert(this.token.transfer(to, 100, { from: admin }));
      });
    });
  });

  describe('transfer from', function () {
   const spender = user1;

   describe('when the recipient is not the zero address', function () {
     const to = user2;

     describe('when the spender has enough approved balance', function () {
       beforeEach(async function () {
         await this.token.approve(spender, 100, { from: admin });
       });

       describe('when the owner has enough balance', function () {
         const amount = 100;

         it('transfers the requested amount', async function () {
           await this.token.transferFrom(admin, to, amount, { from: spender });

           const senderBalance = await this.token.balanceOf(admin);
           assert.equal(senderBalance, 0);

           const recipientBalance = await this.token.balanceOf(to);
           assert.equal(recipientBalance, amount);
         });

         it('decreases the spender allowance', async function () {
           await this.token.transferFrom(admin, to, amount, { from: spender });

           const allowance = await this.token.allowance(admin, spender);
           assert(allowance.eq(0));
         });

         it('emits a transfer event', async function () {
           const { logs } = await this.token.transferFrom(admin, to, amount, { from: spender });

           assert.equal(logs.length, 1);
           assert.equal(logs[0].event, 'Transfer');
           assert.equal(logs[0].args.from, admin);
           assert.equal(logs[0].args.to, to);
           assert(logs[0].args.value.eq(amount));
         });
       });

       describe('when the owner does not have enough balance', function () {
         const amount = 101;

         it('reverts', async function () {
           await assertRevert(this.token.transferFrom(admin, to, amount, { from: spender }));
         });
       });
     });

     describe('when the spender does not have enough approved balance', function () {
       beforeEach(async function () {
         await this.token.approve(spender, 99, { from: admin });
       });

       describe('when the owner has enough balance', function () {
         const amount = 100;

         it('reverts', async function () {
           await assertRevert(this.token.transferFrom(admin, to, amount, { from: spender }));
         });
       });

       describe('when the owner does not have enough balance', function () {
         const amount = 101;

         it('reverts', async function () {
           await assertRevert(this.token.transferFrom(admin, to, amount, { from: spender }));
         });
       });
     });
   });

   describe('when the recipient is the zero address', function () {
     const amount = 100;
     const to = ZERO_ADDRESS;

     beforeEach(async function () {
       await this.token.approve(spender, amount, { from: admin });
     });

     it('reverts', async function () {
       await assertRevert(this.token.transferFrom(admin, to, amount, { from: spender }));
     });
   });
 });

})
