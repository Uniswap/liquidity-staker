pragma solidity ^0.5.16;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract KnowsTime {
    function currentTimestamp() view internal returns (uint32) {
        return uint32(block.timestamp); // == % 2**32
    }
}

// @author Moody Salem
// Rewards a staker in a reward token based on a reward rate.
contract MoodyStakingReward is KnowsTime {
    using SafeMath for uint;

    // the token that is awarded to stakers
    IERC20 public rewardToken;

    // how much of the reward token is awarded pro rata to all stakers per second
    // e.g. if this is 10, and one staker has 60% of the deposited shares, they are awarded 6 shares per second
    uint96 public rewardAmountPerSecond;

    // the first second on which rewards start accumulating
    uint64 public startingSecond;
    // the last second in the reward period, exclusive
    uint64 public endingSecond;

    // when the cumulative reward rate per share was last updated
    uint32 public lastUpdateTimestamp;

    // note: the total amount of reward token required by this contract for distribution is (endingSecond - startingSecond) * rewardAmountPerSecond

    // the (reward amount per second per staked token) * (seconds) for the life of the contract
    // used to compute the average reward amount per second per staked token
    // the rate per share is expressed as a fixed point 96x128
    // the other 32 bits are used to encode the time
    uint public cumulativeRewardRatePerShare;

    // the token that is staked in exchange for rewards
    IERC20 public stakedToken;

    // information about each account's staking
    struct Stake {
        // amount of staking token that is staked
        uint128 amount;

        // the amount of the reward token owed to the staker
        uint96 rewards;

        // the last time this staker info was updated
        uint32 lastUpdateTimestamp;

        // used to compute rewards
        // formula is to first compute time weighted average reward rate per share
        // this is (cumulativeRewardRatePerShare - stake.lastCumulativeRewardRatePerShare) / (lastUpdateTimestamp - stake.lastUpdateTimestamp)
        // then multiply by staked amount and time elapsed to get the rewards for that period
        uint lastCumulativeRewardRatePerShare;
    }

    // how much is staked for each account
    mapping(address => Stake) public stakes;
    uint public totalStakedAmount;

    constructor(IERC20 rewardToken_, IERC20 stakedToken_, uint64 startingSecond_, uint64 endingSecond_, uint96 rewardAmountPerSecond_) public {
        require(startingSecond_ < endingSecond_, 'Starting timestamp must come before ending timestamp');
        require((endingSecond_ - startingSecond_) <= uint32(- 1), 'Period too long');
        require(rewardAmountPerSecond_ > 0, 'Reward amount must be greater than 0');

        rewardToken = rewardToken_;
        stakedToken = stakedToken_;
        rewardAmountPerSecond = rewardAmountPerSecond_;
        startingSecond = startingSecond_;
        endingSecond = endingSecond_;
    }

    function boundedTime(uint64 start, uint64 end, uint32 time) pure private returns (uint32) {
        uint32 truncatedStart = uint32(start);
        uint32 truncatedEnd = uint32(end);
        if (truncatedStart < truncatedEnd) {
            if (time < truncatedStart) return truncatedStart;
            if (time > truncatedEnd) return truncatedEnd;
            return time;
        } else if (truncatedStart > truncatedEnd) {
            // todo: fix this
            if (time > truncatedStart) return time;
            if (time < truncatedEnd) return time;
            return truncatedStart; // assume if it's in between, the period has not started yet
        }
        revert('Unexpected condition');
    }

    // called before any state mutating operations that would affect the rewards rate.
    // updates the cumulative rewards rate up to the current timestamp, *before* the new action that changes it.
    // only needs to happen once per block.
    function _updateCumulativeRewardRatePerShare() internal {
        uint32 time = currentTimestamp();
        if (lastUpdateTimestamp == time) {
            // already updated in this block
            return;
        }

        // set reward rate to 0 if nothing is staked at the beginning of this block
        if (totalStakedAmount == 0) {
            cumulativeRewardRatePerShare = 0;
            lastUpdateTimestamp = time;
            return;
        }

        uint32 boundedLastUpdateTimestamp = boundedTime(startingSecond, endingSecond, lastUpdateTimestamp);
        uint32 boundedCurrentTime = boundedTime(startingSecond, endingSecond, time);
        uint32 rewardedTimeElapsed = boundedCurrentTime - boundedLastUpdateTimestamp;

        cumulativeRewardRatePerShare = cumulativeRewardRatePerShare.add(
            uint(2 ** 128).mul(rewardedTimeElapsed).mul(rewardAmountPerSecond).div(totalStakedAmount)
        );

        lastUpdateTimestamp = time;
    }

    // computes the rewards for the stake given the current total stake amount
    function _computeRewards(Stake storage stake) internal {
        // nothing staked
        if (stake.amount == 0) return;
        // no time has passed since last computation
        if (stake.lastUpdateTimestamp == lastUpdateTimestamp) return;


        uint32 timeElapsed = lastUpdateTimestamp - stake.lastUpdateTimestamp;
        // overflow desired in these subtractions
        uint averageRewardRatePerShare = (cumulativeRewardRatePerShare - stake.lastCumulativeRewardRatePerShare).div(timeElapsed);
        uint rewards = averageRewardRatePerShare.mul(timeElapsed).mul(stake.amount).div(2 ** 128).add(stake.rewards);
        require(rewards <= uint96(-1), 'Rewards overflow: you too paid');
        stake.rewards = uint96(rewards);
        stake.lastCumulativeRewardRatePerShare = cumulativeRewardRatePerShare;
        stake.lastUpdateTimestamp = lastUpdateTimestamp;
    }

    event Deposited(address staker, uint amount);

    // deposit lp shares into the staking contract and begin earning rewards
    function deposit(uint amount) public {
        _updateCumulativeRewardRatePerShare();

        require(stakedToken.transferFrom(msg.sender, address(this), amount), 'MoodyStakingReward: staking transferFrom failed');

        Stake storage stake = stakes[msg.sender];
        _computeRewards(stake);

        uint unsafeAmount = amount.add(uint(stake.amount));
        require(unsafeAmount <= uint128(-1), 'Staking amount overflow: you too rich');
        stake.amount = uint128(unsafeAmount);
        totalStakedAmount = totalStakedAmount.add(amount);
        stake.lastCumulativeRewardRatePerShare = cumulativeRewardRatePerShare;
        stake.lastUpdateTimestamp = currentTimestamp();

        emit Deposited(msg.sender, amount);
    }

    event Withdrawn(address staker, uint amount);

    // withdraw lp shares from the staking contract and stop earning rewards
    // does not collect rewards, must be a separate transaction
    function withdraw(uint amount) public {
        _updateCumulativeRewardRatePerShare();

        Stake storage stake = stakes[msg.sender];
        _computeRewards(stake);

        stake.amount = uint96(uint(stake.amount).sub(amount));
        totalStakedAmount = totalStakedAmount.sub(amount);

        emit Withdrawn(msg.sender, amount);
    }

    event RewardCollected(address staker, uint amount);

    // collect rewards owed to the sender address
    function collect() public {
        _updateCumulativeRewardRatePerShare();

        Stake storage stake = stakes[msg.sender];
        _computeRewards(stake);

        uint owed = stake.rewards;
        if (owed > 0) {
            stake.rewards = 0;
            require(rewardToken.transfer(msg.sender, owed), 'MoodyStakingReward: rewards transfer failed');
        }
        emit RewardCollected(msg.sender, owed);
    }
}
