import chai, { expect } from 'chai'
import { Contract, BigNumber, constants } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utils'

import TestERC20 from '../build/TestERC20.json'
import MoodyStakingReward from '../build/MockTimeMoodyStakingReward.json'

chai.use(solidity)

describe.only('MoodyStakingRewards', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const wallets = provider.getWallets()
  const [wallet0, wallet1] = wallets

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
    await stakingToken.transfer(wallet1.address, 10000)
    await stakingToken.connect(wallet1).approve(stakingRewards.address, constants.MaxUint256)
  })

  it('single staker scenario', async () => {
    await expect(stakingRewards.deposit(100)).to.emit(stakingRewards, 'Deposited').withArgs(wallet0.address, 100)
    expect(await stakingRewards.totalStakedAmount()).to.eq(100)
    expect(await stakingRewards.cumulativeRewardRatePerShare()).to.eq(0)
    expect(await stakingRewards.lastUpdateTimestamp()).to.eq(1800)
    await stakingRewards.setTime(3600)
    await expect(stakingRewards.collect()).to.emit(stakingRewards, 'RewardCollected').withArgs(wallet0.address, 0)
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
    // this is == uint(2 ** 128).mul(rewardedTimeElapsed == 5).mul(rewardAmountPerSecond == 100).div(totalStakedAmount == 100)
    expect(await stakingRewards.cumulativeRewardRatePerShare()).to.eq('1701411834604692317316873037158841057280')
    expect(await stakingRewards.lastUpdateTimestamp()).to.eq(3605)
    await expect(stakingRewards.collect()).to.emit(stakingRewards, 'RewardCollected').withArgs(wallet0.address, 500)
  })

  it('multiple staker scenario', async () => {
    await expect(stakingRewards.deposit(100)).to.emit(stakingRewards, 'Deposited').withArgs(wallet0.address, 100)
    await expect(stakingRewards.connect(wallet1).deposit(200))
      .to.emit(stakingRewards, 'Deposited')
      .withArgs(wallet1.address, 200)
    expect(await stakingRewards.totalStakedAmount()).to.eq(300)
    expect(await stakingRewards.cumulativeRewardRatePerShare()).to.eq(0)
    expect(await stakingRewards.lastUpdateTimestamp()).to.eq(1800)
    await stakingRewards.setTime(3600)

    await expect(stakingRewards.collect()).to.emit(stakingRewards, 'RewardCollected').withArgs(wallet0.address, 0)
    await expect(stakingRewards.connect(wallet1).collect())
      .to.emit(stakingRewards, 'RewardCollected')
      .withArgs(wallet1.address, 0)

    expect(await stakingRewards.cumulativeRewardRatePerShare()).to.eq(0)
    expect(await stakingRewards.lastUpdateTimestamp()).to.eq(3600)

    await stakingRewards.setTime(3605) // 5 seconds = 500

    await expect(stakingRewards.collect()).to.emit(stakingRewards, 'RewardCollected').withArgs(wallet0.address, 166)
    await expect(stakingRewards.connect(wallet1).collect())
      .to.emit(stakingRewards, 'RewardCollected')
      .withArgs(wallet1.address, 333)

    // withdraw 100
    await stakingRewards.withdraw(100)
    // 5 more seconds
    await stakingRewards.setTime(3610) // 5 seconds = 500
    await expect(stakingRewards.connect(wallet1).collect())
      .to.emit(stakingRewards, 'RewardCollected')
      .withArgs(wallet1.address, 500)
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
