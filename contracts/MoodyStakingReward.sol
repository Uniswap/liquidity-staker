pragma solidity ^0.5.16;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/math/Math.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract KnowsTime {
    function currentTimestamp() view internal returns (uint) {
        return block.timestamp;
    }
}

contract MoodyStakingReward is KnowsTime {
    using SafeMath for uint;

    // the token that is awarded to stakers
    IERC20 public rewardToken;
    // how much of the reward token is awarded pro rata to all stakers per second
    // e.g. if this is 10, and one staker has 60% of the deposited shares, they are awarded 6 shares per second
    uint public rewardAmountPerSecond;
    // the first second on which rewards start accumulating
    uint public startingSecond;
    // the last second in the reward period, exclusive
    uint public endingSecond;

    // note: the total amount required by this contract for distribution is (endingSecond - startingSecond) * rewardAmountPerSecond

    // the (reward amount per second per staked token) * (seconds) for the life of the contract
    // used to compute the average reward amount per second per staked token
    // the rate per share is expressed as a fixed point 112x112
    uint public cumulativeRewardRatePerShare;
    // when the last cumulative reward rate was last updated
    uint public lastUpdateTimestamp;

    // the token that is staked in exchange for rewards
    IERC20 public stakedToken;

    // information about each account's staking
    struct Stake {
        // amount of staking token that is staked
        uint amount;
        // the amount of the reward token owed to the staker
        uint rewards;
        // used to compute rewards
        // formula is to first compute time weighted average reward rate per share
        // this is (currentCumulativeRewardRatePerShare - stake.lastCumulativeRewardRatePerShare) / (cumulativeRewardRatePerShare - lastUpdateTimestamp)
        // then multiply by staked amount to get the rewards for that period
        uint lastCumulativeRewardRatePerShare;
        uint lastUpdateTimestamp;
    }

    // how much is staked for each account
    mapping(address => Stake) public stakes;
    uint public totalStakedAmount;

    constructor(IERC20 rewardToken_, IERC20 stakedToken_, uint startingSecond_, uint endingSecond_, uint rewardAmountPerSecond_) public {
        require(startingSecond_ < endingSecond_, 'Starting timestamp must come before ending timestamp');
        require((endingSecond_ - startingSecond_) <= uint32(- 1), 'Period too long');
        require(rewardAmountPerSecond_ > 0, 'Reward amount must be greater than 0');

        rewardToken = rewardToken_;
        stakedToken = stakedToken_;
        rewardAmountPerSecond = rewardAmountPerSecond_;
        startingSecond = startingSecond_;
        endingSecond = endingSecond_;
    }

    function boundedTime(uint start, uint end, uint time) pure private returns (uint) {
        return Math.min(Math.max(time, start), end);
    }

    // called before any state mutating operations that would affect the rewards rate.
    // updates the cumulative rewards rate up to the current timestamp, *before* the new action that changes it.
    // only needs to happen once per block.
    function _updateCumulativeRewardRatePerShare() internal {
        uint time = currentTimestamp();
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

        uint boundedLastUpdateTimestamp = boundedTime(startingSecond, endingSecond, lastUpdateTimestamp);
        uint boundedCurrentTime = boundedTime(startingSecond, endingSecond, time);
        uint rewardedTimeElapsed = boundedCurrentTime.sub(boundedLastUpdateTimestamp);

        cumulativeRewardRatePerShare = cumulativeRewardRatePerShare.add(
            rewardedTimeElapsed.mul(rewardAmountPerSecond).mul(2 ** 112).div(totalStakedAmount)
        );

        lastUpdateTimestamp = time;
    }

    // computes the rewards for the stake given the current total stake amount
    function _computeRewards(Stake storage stake) internal {
        // nothing staked
        if (stake.amount == 0) return;
        // no time has passed since last computation
        if (stake.lastUpdateTimestamp == lastUpdateTimestamp) return;


        uint timeElapsed = lastUpdateTimestamp - stake.lastUpdateTimestamp;
        // overflow desired in these subtractions
        uint averageRewardRatePerShare = (cumulativeRewardRatePerShare - stake.lastCumulativeRewardRatePerShare).div(timeElapsed);
        uint reward = stake.amount.mul(averageRewardRatePerShare.mul(timeElapsed)).div(2 ** 112);
        stake.rewards = stake.rewards.add(reward);
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

        stake.amount = stake.amount.add(amount);
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

        stake.amount = stake.amount.sub(amount);
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
