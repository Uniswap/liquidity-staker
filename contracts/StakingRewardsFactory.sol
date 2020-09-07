pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/IERC20.sol";

import "./StakingRewards.sol";

contract StakingRewardsFactory {
    address public rewardsToken;
    address[] public stakingRewards;
    uint public stakingRewardsGenesis;
    uint public rewardAmount;

    bool notified;

    constructor(address _rewardsToken, address[] memory _stakingRewards, uint _stakingRewardsGenesis, uint rewardAmount_) public {
        rewardsToken = _rewardsToken;
        stakingRewards = _stakingRewards;
        require(_stakingRewardsGenesis >= block.timestamp, "StakingRewardsFactory::constructor: genesis too soon");
        stakingRewardsGenesis = _stakingRewardsGenesis;
        rewardAmount = rewardAmount_;
    }

    function notifyRewardAmounts() public {
        require(!notified, "StakingRewardsFactory::notifyRewardAmounts: already begun");
        require(block.timestamp >= stakingRewardsGenesis, "StakingRewardsFactory::notifyRewardAmounts: not ready");
        for (uint i; i < stakingRewards.length; i++) {
            IERC20(rewardsToken).transfer(stakingRewards[i], rewardAmount);
            StakingRewards(stakingRewards[i]).notifyRewardAmount(rewardAmount);
        }
        notified = true;
    }
}