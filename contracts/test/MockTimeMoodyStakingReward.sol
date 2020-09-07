pragma solidity ^0.5.16;

import "../MoodyStakingReward.sol";

contract MockTimeMoodyStakingReward is MoodyStakingReward {
    uint32 public time;

    constructor(
        IERC20 rewardToken_,
        IERC20 stakedToken_,
        uint64 startingSecond_,
        uint64 endingSecond_,
        uint96 rewardAmountPerSecond_
    ) MoodyStakingReward(rewardToken_, stakedToken_, startingSecond_, endingSecond_, rewardAmountPerSecond_) public {}

    function currentTimestamp() view internal returns (uint32) {
        return time;
    }

    function setTime(uint32 time_) public {
        time = time_;
    }
}
