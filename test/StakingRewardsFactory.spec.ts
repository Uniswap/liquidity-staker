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

  beforeEach('load fixture', async () => {
    const fixture = await loadFixture(stakingRewardsFactoryFixture)
    rewardsToken = fixture.rewardsToken
    stakingRewardsContracts = fixture.stakingRewardsContracts
    genesis = fixture.genesis
    rewardAmounts = fixture.rewardAmounts
    stakingRewardsFactory = fixture.stakingRewardsFactory
  })

  it('deployment gas', async () => {
    const receipt = await provider.getTransactionReceipt(stakingRewardsFactory.deployTransaction.hash)
    expect(receipt.gasUsed).to.eq('578600')
  })

  describe('#notifyRewardsAmounts', () => {
    let totalRewardAmount: BigNumber

    beforeEach(() => {
      totalRewardAmount = rewardAmounts.reduce((accumulator, current) => accumulator.add(current), BigNumber.from(0))
    })

    it('fails if called before genesis', async () => {
      await expect(stakingRewardsFactory.notifyRewardAmounts()).to.be.revertedWith(
        'StakingRewardsFactory::notifyRewardAmounts: not ready'
      )
    })

    it('fails if called twice', async () => {
      await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
      await mineBlock(provider, genesis)
      await stakingRewardsFactory.notifyRewardAmounts()
      await expect(stakingRewardsFactory.notifyRewardAmounts()).to.be.revertedWith(
        'StakingRewardsFactory::notifyRewardAmounts: already notified'
      )
    })

    it('fails if called without sufficient balance', async () => {
      await mineBlock(provider, genesis)
      await expect(stakingRewardsFactory.notifyRewardAmounts()).to.be.revertedWith(
        'SafeMath: subtraction overflow' // emitted from rewards token
      )
    })

    it('succeeds when has sufficient balance and after genesis time', async () => {
      await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
      await mineBlock(provider, genesis)
      await stakingRewardsFactory.notifyRewardAmounts()
    })
  })
})
