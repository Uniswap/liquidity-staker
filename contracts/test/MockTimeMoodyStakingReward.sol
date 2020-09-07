pragma solidity ^0.5.16;

import "../MoodyStakingReward.sol";

contract MockTimeMoodyStakingReward is MoodyStakingReward {
    uint64 public time;

    constructor(
        IERC20 rewardToken_,
        IERC20 stakedToken_,
        uint64 startingSecond_,
        uint64 endingSecond_,
        uint96 rewardAmountPerSecond_
    ) MoodyStakingReward(rewardToken_, stakedToken_, startingSecond_, endingSecond_, rewardAmountPerSecond_) public {}

    function currentTimestamp() view internal returns (uint64) {
        return time;
    }

    function setTime(uint64 time_) public {
        require(time_ > time, 'no backwards time');
        time = time_;
    }
}
