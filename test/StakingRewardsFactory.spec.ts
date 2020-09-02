import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { stakingRewardsFactoryFixture } from './fixtures'
import { REWARDS_DURATION, expandTo18Decimals, mineBlock } from './utils'

chai.use(solidity)

describe('StakingRewardsFactory', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const [wallet, staker] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let stakingTokens: Contract[]
  let rewards: BigNumber[]
  let stakingRewardsFactory: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(stakingRewardsFactoryFixture)
    stakingTokens = fixture.stakingTokens
    rewards = fixture.rewards
    stakingRewardsFactory = fixture.stakingRewardsFactory
  })

  it('test', async () => {
    console.log('test me!')
  })
})
