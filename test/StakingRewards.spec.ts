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

  it('notifyRewardAmount', async () => {
    // send reward to the contract
    const reward = expandTo18Decimals(100)
    await rewardsToken.transfer(stakingRewards.address, reward)
    // must be called by rewardsDistribution
    await stakingRewards.notifyRewardAmount(reward)

    const rewardsStartTime: BigNumber = await stakingRewards.lastUpdateTime()
    const periodFinish: BigNumber = await stakingRewards.periodFinish()
    expect(periodFinish).to.be.eq(rewardsStartTime.add(REWARDS_DURATION))

    // fast-forward ~halfway through the reward window
    await mineBlock(provider, rewardsStartTime.add(Math.floor(REWARDS_DURATION / 2)).toNumber())

    // stake with staker
    const stake = expandTo18Decimals(2)
    await stakingToken.transfer(staker.address, stake)
    await stakingToken.connect(staker).approve(stakingRewards.address, stake)
    await stakingRewards.connect(staker).stake(stake)
    const stakeStartTime: BigNumber = await stakingRewards.lastUpdateTime()

    // fast-forward past the reward window
    await mineBlock(provider, periodFinish.add(1).toNumber())

    // unstake
    await stakingRewards.connect(staker).exit()
    const stakeEndTime: BigNumber = await stakingRewards.lastUpdateTime()
    expect(stakeEndTime).to.be.eq(periodFinish)

    const rewardAmount = await rewardsToken.balanceOf(staker.address)
    expect(reward.div(REWARDS_DURATION).mul(periodFinish.sub(stakeStartTime))).to.be.eq(rewardAmount)
  })
})
