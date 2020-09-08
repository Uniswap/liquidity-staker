pragma solidity ^0.5.16;

import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity-2.3.0/contracts/ownership/Ownable.sol";

import "./StakingRewards.sol";

contract StakingRewardsFactory is Ownable {
    // immutables
    address public rewardsToken;
    uint public stakingRewardsGenesis;

    // the staking tokens
    address[] public stakingTokens;

    struct StakingRewardsInfo {
        address stakingRewards;
        uint rewardAmount;
    }

    // rewards info by staking token
    mapping(address => StakingRewardsInfo) public stakingRewardsInfoByStakingToken;

    constructor(
        address _rewardsToken,
        uint _stakingRewardsGenesis
    ) Ownable() public {
        require(_stakingRewardsGenesis >= block.timestamp, "StakingRewardsFactory::constructor: genesis too soon");

        rewardsToken = _rewardsToken;
        stakingRewardsGenesis = _stakingRewardsGenesis;
    }

    ///// permissioned functions

    // deploy a staking reward contract for the staking token, and store the reward amount
    // the reward will be distributed to the staking reward contract no sooner than the genesis
    function deploy(address stakingToken, uint rewardAmount) public onlyOwner {
        StakingRewardsInfo storage info = stakingRewardsInfoByStakingToken[stakingToken];
        require(info.stakingRewards == address(0), 'StakingRewardsFactory::deploy: already deployed');

        info.stakingRewards = address(new StakingRewards(msg.sender, address(this), rewardsToken, stakingToken));
        info.rewardAmount = rewardAmount;

        // collect the reward amount from the sender to be distributed after genesis
        IERC20(rewardsToken).transferFrom(msg.sender, address(this), rewardAmount);
    }

    ///// permissionless functions

    // call notifyRewardAmount for all staking tokens.
    function notifyRewardAmounts() public {
        require(block.timestamp >= stakingRewardsGenesis, "StakingRewardsFactory::notifyRewardAmounts: not ready");

        for (uint i = 0; i < stakingTokens.length; i++) {
            notifyRewardAmount(stakingTokens[i]);
        }
    }

    // notify reward amount for an individual staking token.
    // this is a fallback in case the notifyRewardAmounts costs too much gas to call for all contracts
    function notifyRewardAmount(address stakingToken) public {
        require(block.timestamp >= stakingRewardsGenesis, "StakingRewardsFactory::notifyRewardAmount: not ready");

        StakingRewardsInfo storage info = stakingRewardsInfoByStakingToken[stakingToken];
        require(info.stakingRewards != address(0), "StakingRewardsFactory::notifyRewardAmount: not deployed");
        require(info.rewardAmount > 0, "StakingRewardsFactory::notifyRewardAmount: no reward to notify");

        uint rewardAmount = info.rewardAmount;
        info.rewardAmount = 0;

        IERC20(rewardsToken).transfer(info.stakingRewards, rewardAmount);
        StakingRewards(info.stakingRewards).notifyRewardAmount(rewardAmount);
    }
}