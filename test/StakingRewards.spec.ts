import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { stakingRewardsFixture } from './fixtures'
import { REWARDS_DURATION, expandTo18Decimals, mineBlock } from './utils'

chai.use(solidity)

describe('StakingRewards', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const [wallet, staker] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let stakingRewards: Contract
  let rewardsToken: Contract
  let stakingToken: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(stakingRewardsFixture)
    stakingRewards = fixture.stakingRewards
    rewardsToken = fixture.rewardsToken
    stakingToken = fixture.stakingToken
  })

  it('rewardsDuration', async () => {
    const rewardsDuration = await stakingRewards.rewardsDuration()
    expect(rewardsDuration).to.be.eq(REWARDS_DURATION)
  })

  const reward = expandTo18Decimals(100)
  async function start(reward: BigNumber): Promise<{ startTime: BigNumber; endTime: BigNumber }> {
    // send reward to the contract
    await rewardsToken.transfer(stakingRewards.address, reward)
    // must be called by rewardsDistribution
    await stakingRewards.notifyRewardAmount(reward)

    const startTime: BigNumber = await stakingRewards.lastUpdateTime()
    const endTime: BigNumber = await stakingRewards.periodFinish()
    expect(endTime).to.be.eq(startTime.add(REWARDS_DURATION))
    return { startTime, endTime }
  }

  it('notifyRewardAmount: full', async () => {
    // stake with staker
    const stake = expandTo18Decimals(2)
    await stakingToken.transfer(staker.address, stake)
    await stakingToken.connect(staker).approve(stakingRewards.address, stake)
    await stakingRewards.connect(staker).stake(stake)

    const { endTime } = await start(reward)

    // fast-forward past the reward window
    await mineBlock(provider, endTime.add(1).toNumber())

    // unstake
    await stakingRewards.connect(staker).exit()
    const stakeEndTime: BigNumber = await stakingRewards.lastUpdateTime()
    expect(stakeEndTime).to.be.eq(endTime)

    const rewardAmount = await rewardsToken.balanceOf(staker.address)
    expect(rewardAmount).to.be.eq(reward.div(REWARDS_DURATION).mul(REWARDS_DURATION))
  })

  it('notifyRewardAmount: ~half', async () => {
    const { startTime, endTime } = await start(reward)

    // fast-forward ~halfway through the reward window
    await mineBlock(provider, startTime.add(endTime.sub(startTime).div(2)).toNumber())

    // stake with staker
    const stake = expandTo18Decimals(2)
    await stakingToken.transfer(staker.address, stake)
    await stakingToken.connect(staker).approve(stakingRewards.address, stake)
    await stakingRewards.connect(staker).stake(stake)
    const stakeStartTime: BigNumber = await stakingRewards.lastUpdateTime()

    // fast-forward past the reward window
    await mineBlock(provider, endTime.add(1).toNumber())

    // unstake
    await stakingRewards.connect(staker).exit()
    const stakeEndTime: BigNumber = await stakingRewards.lastUpdateTime()
    expect(stakeEndTime).to.be.eq(endTime)

    const rewardAmount = await rewardsToken.balanceOf(staker.address)
    expect(rewardAmount).to.be.eq(reward.div(REWARDS_DURATION).mul(endTime.sub(stakeStartTime)))
  })
})
