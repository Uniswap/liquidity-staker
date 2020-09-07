import chai, { expect } from 'chai'
import { Contract, BigNumber, constants } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utils'

import TestERC20 from '../build/TestERC20.json'
import MoodyStakingReward from '../build/MockTimeMoodyStakingReward.json'

chai.use(solidity)

describe('MoodyStakingRewards', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const wallets = provider.getWallets()
  const [wallet0, wallet1, wallet2, wallet3] = wallets

  let stakingRewards: Contract
  let rewardsToken: Contract
  let stakingToken: Contract

  beforeEach('deploy tokens', async () => {
    rewardsToken = await deployContract(wallet0, TestERC20, [expandTo18Decimals(1000000)])
    stakingToken = await deployContract(wallet0, TestERC20, [expandTo18Decimals(1000000)])
  })

  beforeEach('deploy staking rewards', async () => {
    stakingRewards = await deployContract(wallet0, MoodyStakingReward, [
      rewardsToken.address,
      stakingToken.address,
      3600,
      7200,
      100,
    ])
  })

  beforeEach('set starting time', async () => {
    await stakingRewards.setTime(1800)
  })

  beforeEach('fund staking rewards', async () => {
    await rewardsToken.transfer(stakingRewards.address, 360000)
  })

  beforeEach('approve spending of staking rewards', async () => {
    await stakingToken.approve(stakingRewards.address, constants.MaxUint256)
    await stakingToken.connect(wallet1).approve(stakingRewards.address, constants.MaxUint256)
    await stakingToken.connect(wallet2).approve(stakingRewards.address, constants.MaxUint256)
    await stakingToken.connect(wallet3).approve(stakingRewards.address, constants.MaxUint256)
  })

  beforeEach('fund other wallets', async () => {
    await stakingToken.transfer(wallet1.address, 10000)
    await stakingToken.transfer(wallet2.address, 10000)
    await stakingToken.transfer(wallet3.address, 10000)
  })

  it('deployment gas', async () => {
    const receipt = await provider.getTransactionReceipt(stakingRewards.deployTransaction.hash)
    expect(receipt.gasUsed).to.eq(1050575)
  })

  describe('scenarios', () => {
    it('single staker scenario', async () => {
      await expect(stakingRewards.deposit(100)).to.emit(stakingRewards, 'Deposit').withArgs(wallet0.address, 100)
      expect(await stakingRewards.totalStakedAmount()).to.eq(100)
      expect(await stakingRewards.cumulativeRewardRatePerShare()).to.eq(0)
      expect(await stakingRewards.lastUpdateTimestamp()).to.eq(1800)
      await stakingRewards.setTime(3600)
      await expect(stakingRewards.collect()).to.emit(stakingRewards, 'Collect').withArgs(wallet0.address, 0)
      expect(await stakingRewards.cumulativeRewardRatePerShare()).to.eq(0)
      expect(await stakingRewards.lastUpdateTimestamp()).to.eq(3600)

      await stakingRewards.setTime(3605) // 5 seconds = 500

      const [amount, rewards, lastUpdateTimestamp, lastCumulativeRewardRatePerShare] = await stakingRewards.stakes(
        wallet0.address
      )
      expect(amount).to.eq(100)
      expect(rewards).to.eq(0)
      expect(lastCumulativeRewardRatePerShare).to.eq(0)
      expect(lastUpdateTimestamp).to.eq(3600)

      await stakingRewards.deposit(1)
      // this is == uint(2 ** 96).mul(rewardedTimeElapsed == 5).mul(rewardAmountPerSecond == 100).div(totalStakedAmount == 100)
      expect(await stakingRewards.cumulativeRewardRatePerShare()).to.eq('396140812571321687967719751680')
      expect(await stakingRewards.lastUpdateTimestamp()).to.eq(3605)
      await expect(stakingRewards.collect()).to.emit(stakingRewards, 'Collect').withArgs(wallet0.address, 500)
    })

    it('multiple staker scenario', async () => {
      await expect(stakingRewards.deposit(100)).to.emit(stakingRewards, 'Deposit').withArgs(wallet0.address, 100)
      await expect(stakingRewards.connect(wallet1).deposit(200))
        .to.emit(stakingRewards, 'Deposit')
        .withArgs(wallet1.address, 200)
      expect(await stakingRewards.totalStakedAmount()).to.eq(300)
      expect(await stakingRewards.cumulativeRewardRatePerShare()).to.eq(0)
      expect(await stakingRewards.lastUpdateTimestamp()).to.eq(1800)
      await stakingRewards.setTime(3600)

      await expect(stakingRewards.collect()).to.emit(stakingRewards, 'Collect').withArgs(wallet0.address, 0)
      await expect(stakingRewards.connect(wallet1).collect())
        .to.emit(stakingRewards, 'Collect')
        .withArgs(wallet1.address, 0)

      expect(await stakingRewards.cumulativeRewardRatePerShare()).to.eq(0)
      expect(await stakingRewards.lastUpdateTimestamp()).to.eq(3600)

      await stakingRewards.setTime(3605) // 5 seconds = 500

      await expect(stakingRewards.collect()).to.emit(stakingRewards, 'Collect').withArgs(wallet0.address, 166)
      await expect(stakingRewards.connect(wallet1).collect())
        .to.emit(stakingRewards, 'Collect')
        .withArgs(wallet1.address, 333)

      // withdraw 100
      await stakingRewards.withdraw(100)
      // 5 more seconds
      await stakingRewards.setTime(3610) // 5 seconds = 500
      await expect(stakingRewards.connect(wallet1).collect())
        .to.emit(stakingRewards, 'Collect')
        .withArgs(wallet1.address, 500)
    })

    it.only('multiple staker entire period', async () => {
      await stakingRewards.deposit(100)
      await stakingRewards.connect(wallet1).deposit(200)
      await stakingRewards.setTime(3700)

      await expect(stakingRewards.connect(wallet2).deposit(200))
      await stakingRewards.setTime(4500)

      await stakingRewards.deposit(200)
      await stakingRewards.setTime(4600)
      await stakingRewards.connect(wallet2).deposit(300)
      await stakingRewards.setTime(6000)
      await stakingRewards.connect(wallet2).withdraw(100)
      await stakingRewards.connect(wallet1).deposit(100)
      let total: number = 0
      await expect(stakingRewards.collect()).to.emit(stakingRewards, 'Collect').withArgs(wallet0.address, 76284)
      total += 76284
      await stakingRewards.setTime(7500)

      await expect(stakingRewards.collect()).to.emit(stakingRewards, 'Collect').withArgs(wallet0.address, 35999)
      total += 35999
      await expect(stakingRewards.connect(wallet1).collect())
        .to.emit(stakingRewards, 'Collect')
        .withArgs(wallet1.address, 126856)
      total += 126856
      await expect(stakingRewards.connect(wallet2).collect())
        .to.emit(stakingRewards, 'Collect')
        .withArgs(wallet2.address, 120855)
      total += 120855

      await stakingRewards.setTime(7800)

      await expect(stakingRewards.collect()).to.emit(stakingRewards, 'Collect').withArgs(wallet0.address, 0)
      await expect(stakingRewards.connect(wallet1).collect())
        .to.emit(stakingRewards, 'Collect')
        .withArgs(wallet1.address, 0)
      await expect(stakingRewards.connect(wallet2).collect())
        .to.emit(stakingRewards, 'Collect')
        .withArgs(wallet2.address, 0)

      expect(total).to.eq(359994) // almost exactly 360000
    })
  })

  describe('before staking period begins', () => {
    describe('#deposit', () => {
      it('sets the staked amount', async () => {
        await stakingRewards.deposit(100)
        const [amount, rewards, lastUpdateTimestamp, lastCumulativeRewardRatePerShare] = await stakingRewards.stakes(
          wallet0.address
        )
        expect(amount).to.eq(100)
        expect(rewards).to.eq(0)
        expect(lastCumulativeRewardRatePerShare).to.eq(0)
        expect(lastUpdateTimestamp).to.eq(1800)
      })

      it('adds to the staked amount', async () => {
        await stakingRewards.deposit(100)
        await stakingRewards.deposit(200)
        const [amount, rewards, lastUpdateTimestamp, lastCumulativeRewardRatePerShare] = await stakingRewards.stakes(
          wallet0.address
        )
        expect(amount).to.eq(300)
        expect(rewards).to.eq(0)
        expect(lastCumulativeRewardRatePerShare).to.eq(0)
        expect(lastUpdateTimestamp).to.eq(1800)
      })

      it('updates cumulative variables', async () => {
        await stakingRewards.deposit(100)
        expect(await stakingRewards.cumulativeRewardRatePerShare()).to.eq(0)
        expect(await stakingRewards.lastUpdateTimestamp()).to.eq(1800)
      })

      it('gas', async () => {
        const tx = await stakingRewards.deposit(100)
        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq('119525')
      })
    })
  })
})
