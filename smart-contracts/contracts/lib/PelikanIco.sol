pragma solidity ^0.4.19;

contract PelikanIco {
  /* Pelikan compatibility : Event to raise when address contributes */
  event AddressDeposited (
    address indexed depositor,
    uint depositedAt,
    uint amount,
    uint tokenAmount,
    bool indexed boughtOnBehalf
  );

  /* Current distribution information */
  function distributionInfo() public constant returns (
    uint minContrib,
    uint maxContrib,
    uint currentTokenPrice,
    uint currentBonus,
    uint remainingSupply
  );
}
