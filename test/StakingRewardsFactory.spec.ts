import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { stakingRewardsFactoryFixture } from './fixtures'
import { mineBlock } from './utils'

chai.use(solidity)

describe('StakingRewardsFactory', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const [wallet] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let rewardsToken: Contract
  let stakingRewardsContracts: Contract[]
  let reward: BigNumber
  let stakingRewardsFactory: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(stakingRewardsFactoryFixture)
    rewardsToken = fixture.rewardsToken
    stakingRewardsContracts = fixture.stakingRewardsContracts
    reward = fixture.reward
    stakingRewardsFactory = fixture.stakingRewardsFactory
  })

  it('notifyRewardAmounts', async () => {
    const { timestamp: now } = await provider.getBlock('latest')
    await mineBlock(provider, now + 60 * 60)

    // send reward to the factory
    await rewardsToken.transfer(stakingRewardsFactory.address, reward.mul(stakingRewardsContracts.length))

    await stakingRewardsFactory.notifyRewardAmounts()
  })
})
