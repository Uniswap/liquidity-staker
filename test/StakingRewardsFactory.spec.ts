import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { stakingRewardsFactoryFixture } from './fixtures'
import { mineBlock } from './utils'

import StakingRewards from '../build/StakingRewards.json'

chai.use(solidity)

describe('StakingRewardsFactory', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const [wallet, wallet1] = provider.getWallets()
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
    expect(receipt.gasUsed).to.eq('2080815')
  })

  describe('#deploy', () => {
    it('pushes the token into the list', async () => {
      await stakingRewardsFactory.deploy(stakingTokens[1].address, 10000)
      expect(await stakingRewardsFactory.stakingTokens(0)).to.eq(stakingTokens[1].address)
    })

    it('fails if called twice for same token', async () => {
      await stakingRewardsFactory.deploy(stakingTokens[1].address, 10000)
      await expect(stakingRewardsFactory.deploy(stakingTokens[1].address, 10000)).to.revertedWith(
        'StakingRewardsFactory::deploy: already deployed'
      )
    })

    it('can only be called by the owner', async () => {
      await expect(stakingRewardsFactory.connect(wallet1).deploy(stakingTokens[1].address, 10000)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('stores the address of stakingRewards and reward amount', async () => {
      await stakingRewardsFactory.deploy(stakingTokens[1].address, 10000)
      const [stakingRewards, rewardAmount] = await stakingRewardsFactory.stakingRewardsInfoByStakingToken(
        stakingTokens[1].address
      )
      expect(await provider.getCode(stakingRewards)).to.not.eq('0x')
      expect(rewardAmount).to.eq(10000)
    })

    it('deployed staking rewards has correct parameters', async () => {
      await stakingRewardsFactory.deploy(stakingTokens[1].address, 10000)
      const [stakingRewardsAddress] = await stakingRewardsFactory.stakingRewardsInfoByStakingToken(
        stakingTokens[1].address
      )
      const stakingRewards = new Contract(stakingRewardsAddress, StakingRewards.abi, provider)
      expect(await stakingRewards.rewardsDistribution()).to.eq(stakingRewardsFactory.address)
      expect(await stakingRewards.stakingToken()).to.eq(stakingTokens[1].address)
      expect(await stakingRewards.rewardsToken()).to.eq(rewardsToken.address)
    })
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
      let stakingRewards: Contract[]
      beforeEach('deploy staking reward contracts', async () => {
        stakingRewards = []
        for (let i = 0; i < stakingTokens.length; i++) {
          await stakingRewardsFactory.deploy(stakingTokens[i].address, rewardAmounts[i])
          const [stakingRewardsAddress] = await stakingRewardsFactory.stakingRewardsInfoByStakingToken(
            stakingTokens[i].address
          )
          stakingRewards.push(new Contract(stakingRewardsAddress, StakingRewards.abi, provider))
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

      it('calls notifyRewards on each contract', async () => {
        await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
        await mineBlock(provider, genesis)
        await expect(stakingRewardsFactory.notifyRewardAmounts())
          .to.emit(stakingRewards[0], 'RewardAdded')
          .withArgs(rewardAmounts[0])
          .to.emit(stakingRewards[1], 'RewardAdded')
          .withArgs(rewardAmounts[1])
          .to.emit(stakingRewards[2], 'RewardAdded')
          .withArgs(rewardAmounts[2])
          .to.emit(stakingRewards[3], 'RewardAdded')
          .withArgs(rewardAmounts[3])
      })

      it('transfers the reward tokens to the individual contracts', async () => {
        await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
        await mineBlock(provider, genesis)
        await stakingRewardsFactory.notifyRewardAmounts()
        for (let i = 0; i < rewardAmounts.length; i++) {
          expect(await rewardsToken.balanceOf(stakingRewards[i].address)).to.eq(rewardAmounts[i])
        }
      })

      it('sets rewardAmount to 0', async () => {
        await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
        await mineBlock(provider, genesis)
        for (let i = 0; i < stakingTokens.length; i++) {
          const [, amount] = await stakingRewardsFactory.stakingRewardsInfoByStakingToken(stakingTokens[i].address)
          expect(amount).to.eq(rewardAmounts[i])
        }
        await stakingRewardsFactory.notifyRewardAmounts()
        for (let i = 0; i < stakingTokens.length; i++) {
          const [, amount] = await stakingRewardsFactory.stakingRewardsInfoByStakingToken(stakingTokens[i].address)
          expect(amount).to.eq(0)
        }
      })

      it('succeeds when has sufficient balance and after genesis time', async () => {
        await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
        await mineBlock(provider, genesis)
        await stakingRewardsFactory.notifyRewardAmounts()
      })
    })
  })
})
