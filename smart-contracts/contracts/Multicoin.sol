pragma solidity ^0.4.19;

import "./lib/Owned.sol";
import "./lib/SafeMath.sol";
import "./lib/ERC20Interface.sol";
import "./lib/ApproveAndCallFallBack.sol";

contract Multicoin is Owned, ERC20Interface {
  /* Avoiding overflows at all costs :) */
  using SafeMath for uint;

  /* ERC20 Attributes */
  mapping(address => uint256) balances;
  mapping(address => mapping (address => uint256)) allowed;
  mapping(address => bool) public freezeBypassing;

  string public symbol = 'MTC';
  string public  name = 'Multicoin';
  uint8 public decimals = 18;
  uint public _totalSupply = 2000000000 * 10**uint(decimals);
  uint public _circulatingSupply = 0;
  bool public tradingLive = false;

  function distributeSupply(address to, uint tokens) public onlyOwner returns (bool success) {
    uint tokenAmount = tokens.mul(10**uint(decimals));
    require(_circulatingSupply.add(tokenAmount) <= _totalSupply);
    _circulatingSupply = _circulatingSupply.add(tokenAmount);
    balances[to] = tokenAmount;
    return true;
  }

  function allowFreezeBypass(address sender) public onlyOwner returns (bool success) {
    freezeBypassing[sender] = true;
    return true;
  }

  function setTradingLive() public onlyOwner returns (bool tradingStatus) {
    tradingLive = true;
    return tradingLive;
  }

  modifier tokenTradingMustBeLive(address sender) {
    require(tradingLive || freezeBypassing[sender]);
    _;
  }

  /* ERC20 Implementation */
  function totalSupply() public constant returns (uint) {
    return _totalSupply;
  }

  function balanceOf(address tokenOwner) public constant returns (uint balance) {
    return balances[tokenOwner];
  }

  function transfer(address to, uint tokens) public tokenTradingMustBeLive(msg.sender) returns (bool success) {
    balances[msg.sender] = balances[msg.sender].sub(tokens);
    balances[to] = balances[to].add(tokens);
    Transfer(msg.sender, to, tokens);
    return true;
  }

  function transferFrom(address from, address to, uint tokens) public tokenTradingMustBeLive(from) returns (bool success) {
    balances[from] = balances[from].sub(tokens);
    allowed[from][msg.sender] = allowed[from][msg.sender].sub(tokens);
    balances[to] = balances[to].add(tokens);
    Transfer(from, to, tokens);
    return true;
  }

  function approve(address spender, uint tokens) public returns (bool success) {
    allowed[msg.sender][spender] = tokens;
    Approval(msg.sender, spender, tokens);
    return true;
  }

  function allowance(address tokenOwner, address spender) public constant returns (uint remaining) {
    return allowed[tokenOwner][spender];
  }
  /* End of default ERC20 Implementation */

  /* trigger the receiveApproval(...) on spender contract */
  function approveAndCall(address spender, uint tokens, bytes data) public returns (bool success) {
    allowed[msg.sender][spender] = tokens;
    Approval(msg.sender, spender, tokens);
    ApproveAndCallFallBack(spender).receiveApproval(msg.sender, tokens, this, data);
    return true;
  }

  /* Owner can transfer out any accidentally sent ERC20 tokens */
  function transferAnyERC20Token(address tokenAddress, uint tokens) public onlyOwner returns (bool success) {
    return ERC20Interface(tokenAddress).transfer(owner, tokens);
  }
}
