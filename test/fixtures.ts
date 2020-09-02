import chai, { expect } from 'chai'
import { Contract, Wallet, BigNumber } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utils'

import TestERC20 from '../build/TestERC20.json'
import StakingRewards from '../build/StakingRewards.json'
import StakingRewardsFactory from '../build/StakingRewardsFactory.json'

chai.use(solidity)

interface StakingRewardsFixture {
  stakingRewards: Contract
  rewardsToken: Contract
  stakingToken: Contract
}

export async function stakingRewardsFixture([wallet]: Wallet[]): Promise<StakingRewardsFixture> {
  const owner = wallet.address
  const rewardsDistribution = wallet.address
  const rewardsToken = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])
  const stakingToken = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])

  const stakingRewards = await deployContract(wallet, StakingRewards, [
    owner,
    rewardsDistribution,
    rewardsToken.address,
    stakingToken.address,
  ])

  return { stakingRewards, rewardsToken, stakingToken }
}

interface StakingRewardsFactoryFixture {
  stakingTokens: Contract[]
  rewards: BigNumber[]
  stakingRewardsFactory: Contract
}

export async function stakingRewardsFactoryFixture([wallet]: Wallet[]): Promise<StakingRewardsFactoryFixture> {
  const owner = wallet.address
  const rewardsToken = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])
  const stakingTokens = []
  const rewards = []
  for (let i = 0; i < 30; i++) {
    const stakingToken = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])
    stakingTokens.push(stakingToken)
    rewards.push(expandTo18Decimals(i + 1))
  }

  const stakingRewardsFactory = await deployContract(wallet, StakingRewardsFactory, [
    owner,
    rewardsToken.address,
    stakingTokens.map((stakingToken) => stakingToken.address),
    rewards,
  ])

  const receipt = await stakingRewardsFactory.deployTransaction.wait()
  expect(receipt.gasUsed).to.eq(459604)

  return { stakingTokens, rewards, stakingRewardsFactory }
}
