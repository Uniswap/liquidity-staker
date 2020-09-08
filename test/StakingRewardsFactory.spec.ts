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
  let genesis: number
  let rewardAmounts: BigNumber[]
  let stakingRewardsFactory: Contract
  let stakingTokens: Contract[]

  beforeEach('load fixture', async () => {
    const fixture = await loadFixture(stakingRewardsFactoryFixture)
    rewardsToken = fixture.rewardsToken
    genesis = fixture.genesis
    rewardAmounts = fixture.rewardAmounts
    stakingRewardsFactory = fixture.stakingRewardsFactory
    stakingTokens = fixture.stakingTokens
  })

  it('deployment gas', async () => {
    const receipt = await provider.getTransactionReceipt(stakingRewardsFactory.deployTransaction.hash)
    expect(receipt.gasUsed).to.eq('1914571')
  })

  describe('#notifyRewardsAmounts', () => {
    let totalRewardAmount: BigNumber

    beforeEach(() => {
      totalRewardAmount = rewardAmounts.reduce((accumulator, current) => accumulator.add(current), BigNumber.from(0))
    })

    it('called before any deploys', async () => {
      await expect(stakingRewardsFactory.notifyRewardAmounts()).to.be.revertedWith(
        'StakingRewardsFactory::notifyRewardAmounts: called before any deploys'
      )
    })

    describe('after deploying all staking reward contracts', async () => {
      beforeEach('deploy staking reward contracts', async () => {
        for (let i = 0; i < stakingTokens.length; i++) {
          await stakingRewardsFactory.deploy(stakingTokens[i].address, rewardAmounts[i])
        }
      })

      it('gas', async () => {
        await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
        await mineBlock(provider, genesis)
        const tx = await stakingRewardsFactory.notifyRewardAmounts()
        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq('416215')
      })

      it('no op if called twice', async () => {
        await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
        await mineBlock(provider, genesis)
        await expect(stakingRewardsFactory.notifyRewardAmounts()).to.emit(rewardsToken, 'Transfer')
        await expect(stakingRewardsFactory.notifyRewardAmounts()).to.not.emit(rewardsToken, 'Transfer')
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
})
