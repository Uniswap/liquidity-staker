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

  beforeEach('fund staking rewards', async () => {
    await rewardsToken.transfer(stakingRewards.address, 360000)
  })

  beforeEach('approve spending of staking rewards', async () => {
    await stakingToken.approve(stakingRewards.address, constants.MaxUint256)
  })

  describe('before staking period begins', () => {
    describe('#deposit', () => {
      it('updates cumulative reward', async () => {
        // deposit 100 staking tokens
        // entitles to 100 tokens per second
        await stakingRewards.deposit(100)
      })
    })
  })
})
