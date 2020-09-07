pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/IERC20.sol";

import "./StakingRewards.sol";

contract StakingRewardsFactory {
    address public rewardsToken;
    uint[] public rewardAmounts;
    address[] public stakingRewards;
    uint public stakingRewardsGenesis;

    bool notified;

    constructor(
        address _rewardsToken,
        uint[] memory _rewardAmounts,
        address[] memory _stakingRewards,
        uint _stakingRewardsGenesis
    ) public {
        require(_rewardAmounts.length == _stakingRewards.length, "StakingRewardsFactory::constructor: length mismatch");
        require(_stakingRewardsGenesis >= block.timestamp, "StakingRewardsFactory::constructor: genesis too soon");

        rewardsToken = _rewardsToken;
        rewardAmounts = _rewardAmounts;
        stakingRewards = _stakingRewards;
        stakingRewardsGenesis = _stakingRewardsGenesis;
    }

    function notifyRewardAmounts() public {
        require(!notified, "StakingRewardsFactory::notifyRewardAmounts: already notified");
        require(block.timestamp >= stakingRewardsGenesis, "StakingRewardsFactory::notifyRewardAmounts: not ready");
        for (uint i; i < rewardAmounts.length; i++) {
            IERC20(rewardsToken).transfer(stakingRewards[i], rewardAmounts[i]);
            StakingRewards(stakingRewards[i]).notifyRewardAmount(rewardAmounts[i]);
        }
        notified = true;
    }
}