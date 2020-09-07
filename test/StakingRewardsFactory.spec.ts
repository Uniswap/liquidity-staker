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
  let genesis: number
  let rewardAmounts: BigNumber[]
  let stakingRewardsFactory: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(stakingRewardsFactoryFixture)
    rewardsToken = fixture.rewardsToken
    stakingRewardsContracts = fixture.stakingRewardsContracts
    genesis = fixture.genesis
    rewardAmounts = fixture.rewardAmounts
    stakingRewardsFactory = fixture.stakingRewardsFactory
  })

  it('notifyRewardAmounts:fail', async () => {
    await expect(stakingRewardsFactory.notifyRewardAmounts()).to.be.revertedWith(
      'StakingRewardsFactory::notifyRewardAmounts: not ready'
    )
  })

  it('notifyRewardAmounts', async () => {
    // send reward to the factory
    const totalRewardAmount = rewardAmounts.reduce(
      (accumulator, current) => accumulator.add(current),
      BigNumber.from(0)
    )
    await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)

    await mineBlock(provider, genesis)

    await stakingRewardsFactory.notifyRewardAmounts()

    await expect(stakingRewardsFactory.notifyRewardAmounts()).to.be.revertedWith(
      'StakingRewardsFactory::notifyRewardAmounts: already notified'
    )
  })
})
