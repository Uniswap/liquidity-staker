pragma solidity ^0.5.16;

import "../MoodyStakingReward.sol";

contract MockTimeMoodyStakingReward is MoodyStakingReward {
    uint public time;

    constructor(
        IERC20 rewardToken_,
        IERC20 stakedToken_,
        uint startingSecond_,
        uint endingSecond_,
        uint rewardAmountPerSecond_
    ) MoodyStakingReward(rewardToken_, stakedToken_, startingSecond_, endingSecond_, rewardAmountPerSecond_) public {}

    function setTime(uint time_) public {
        time = time_;
    }
}
