pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/IERC20.sol";

import "./StakingRewards.sol";

contract StakingRewardsFactory {
    address public owner;
    address public rewardsToken;

    address[] public stakingTokens;
    uint[]    public rewards;
    address[] public stakingRewards;

    constructor(address _owner, address _rewardsToken, address[] memory _stakingTokens, uint[] memory _rewards) public {
        require(_stakingTokens.length == _rewards.length, 'StakingRewardsFactory: Lengths are different.');
        owner = _owner;
        rewardsToken = _rewardsToken;
        for (uint i; i < stakingTokens.length; i++) {
            stakingTokens[i]  = _stakingTokens[i];
            rewards[i]        = _rewards[i];
            stakingRewards[i] = address(new StakingRewards(owner, address(this), rewardsToken, stakingTokens[i]));
        }
    }

    function notifyRewardAmounts() public {
        for (uint i; i < stakingTokens.length; i++) {
            IERC20(rewardsToken).transfer(stakingRewards[i], rewards[i]);
            StakingRewards(stakingRewards[i]).notifyRewardAmount(rewards[i]);
        }
    }
}