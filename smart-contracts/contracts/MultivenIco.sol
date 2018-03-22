pragma solidity ^0.4.19;

import "./lib/Owned.sol";
import "./lib/SafeMath.sol";
import "./lib/ERC20Interface.sol";
import "./lib/PelikanIco.sol";
import "./lib/KycRegistryInterface.sol";

contract MultivenIco is Owned, PelikanIco {
  using SafeMath for uint;

  struct IcoRound {
    uint minContribution;
    uint maxContribution;
    uint supplyAllowed;
    uint supplyDistributed;
    uint bonusAllocation;
  }

  event RemainingTokensSent(uint tokenSent, uint timestamp);

  mapping (uint8 => IcoRound) icoRounds;
  mapping (address => mapping(uint8 => uint)) totalCountributed;
  uint8 public currentIcoRound = 0;
  uint public tokenPrice = 0.01 ether;

  uint public totalEtherRaised = 0;

  ERC20Interface multicoin;
  KycRegistryInterface kycRegistry;
  address public multivenWallet;

  modifier mustBeKycCleared(address _address) {
    require(kycRegistry.isAddressCleared(_address));
    _;
  }

  /* Pelikan Ico API : Method to implement */
  function distributionInfo() public constant returns (
    uint minContrib,
    uint maxContrib,
    uint currentTokenPrice,
    uint currentBonus,
    uint remainingSupply
  ) {
    minContrib = icoRounds[currentIcoRound].minContribution;
    maxContrib = icoRounds[currentIcoRound].maxContribution;
    currentTokenPrice = tokenPrice;
    currentBonus = icoRounds[currentIcoRound].bonusAllocation;
    remainingSupply = icoRounds[currentIcoRound].supplyAllowed.sub(icoRounds[currentIcoRound].supplyDistributed);
  }

  function MultivenIco(
    address kycRegistryAddress,
    address multicoinAddress,
    address multivenWalletAddress,

    uint round1Supply,
    uint round2supply,
    uint round3Supply,
    uint round4Supply
  ) public {
    kycRegistry = KycRegistryInterface(kycRegistryAddress);
    multicoin = ERC20Interface(multicoinAddress);
    multivenWallet = multivenWalletAddress;

    icoRounds[1] = IcoRound(
      100 finney,
      1000 ether,
      round1Supply*(10**18),
      0,
      125
    );

    icoRounds[2] = IcoRound(
      100 finney,
      500 ether,
      round2supply*(10**18),
      0,
      120
    );

    icoRounds[3] = IcoRound(
      100 finney,
      250 ether,
      round3Supply*(10**18),
      0,
      115
    );

    icoRounds[4] = IcoRound(
      100 finney,
      50 ether,
      round4Supply*(10**18),
      0,
      100
    );
  }

  function() public mustBeKycCleared(msg.sender) payable {
    // Checks if distribution round
    require(currentIcoRound > 0 && currentIcoRound <= 4);

    require(
      msg.value >= icoRounds[currentIcoRound].minContribution &&
      totalCountributed[msg.sender][currentIcoRound].add(msg.value) <= icoRounds[currentIcoRound].maxContribution
    );

    totalCountributed[msg.sender][currentIcoRound] = totalCountributed[msg.sender][currentIcoRound].add(msg.value);

    // Gets token amount to count and release
    uint countedAmount;
    uint givenAmount;
    (countedAmount, givenAmount) = tokenAmount(msg.value, icoRounds[currentIcoRound].bonusAllocation);

    // Anticipate new supply of round
    uint newSupply = icoRounds[currentIcoRound].supplyDistributed.add(countedAmount);

    // Checks if this supply can be given
    require(newSupply <= icoRounds[currentIcoRound].supplyAllowed);
    icoRounds[currentIcoRound].supplyDistributed = newSupply;

    // Add the received value to the total received
    totalEtherRaised += msg.value;

    // Transfer the value to the holder wallet
    multivenWallet.transfer(msg.value);

    // Do the transfer of token
    multicoin.transfer(msg.sender, givenAmount);

    // If the supply is empty, go to next round automatically
    if(icoRounds[currentIcoRound].supplyDistributed == icoRounds[currentIcoRound].supplyAllowed) {
      currentIcoRound += 1;

      // Deverse ICO token remaining supply if reached the end
      if(currentIcoRound == 5) {
        withdrawRemainingMulticoins();
      }
    }

    // Raise the AddressDeposited (Pelikan Ico API) event
    AddressDeposited(
      msg.sender,
      block.timestamp,
      msg.value,
      givenAmount,
      false
    );
  }

  function tokenAmount(uint value, uint bonusAllocation) public constant returns (uint countedAmount, uint givenAmount) {
    // Amount given for book keeping (theorical amount, without bonus)
    countedAmount = value / tokenPrice * (10**18);

    // Real amount given (including bonus)
    givenAmount = countedAmount * bonusAllocation / 100;
  }

  function goToNextRound() public onlyOwner returns (bool success) {
    // Checks if possible next round
    require(currentIcoRound >= 0 && currentIcoRound < 5);

    // Load current round details
    uint remainingSupply =
      icoRounds[currentIcoRound].supplyAllowed.sub(icoRounds[currentIcoRound].supplyDistributed);

    // Increase currentRound integer
    currentIcoRound += 1;

    if(currentIcoRound == 5) {
      // Deverse ICO token remaining supply if reached the end
      return withdrawRemainingMulticoins();
    } else {
      // Load next round by giving current round remaining supply to the next round
      icoRounds[currentIcoRound].supplyAllowed = 
        icoRounds[currentIcoRound].supplyAllowed.add(remainingSupply);
      return true;
    }
  }

  function withdrawRemainingMulticoins() private returns (bool success) {
    uint icoRemainingSupply = multicoin.balanceOf(address(this));
    RemainingTokensSent(icoRemainingSupply, block.timestamp);
    return multicoin.transfer(multivenWallet, icoRemainingSupply);
  }
}
