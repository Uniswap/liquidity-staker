import chai from 'chai'
import { Contract } from 'ethers'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { stakingRewardsFixture } from './fixtures'

chai.use(solidity)

describe('StakingRewards', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const [wallet] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let stakingRewards: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(stakingRewardsFixture)
    stakingRewards = fixture.stakingRewards
  })

  it('test', async () => {
    console.log('great success')
  })
})
