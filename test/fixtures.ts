import chai, { expect } from 'chai'
import { Contract, Wallet, BigNumber, providers } from 'ethers'
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
  rewardsToken: Contract
  stakingTokens: Contract[]
  stakingRewardsContracts: Contract[]
  reward: BigNumber
  stakingRewardsFactory: Contract
}

export async function stakingRewardsFactoryFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<StakingRewardsFactoryFixture> {
  const owner = wallet.address
  const rewardsToken = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])

  const stakingRewardsFactoryAddress = Contract.getContractAddress({ from: wallet.address, nonce: 9 })

  const stakingTokens = []
  const stakingRewardsContracts = []

  for (let i = 0; i < 4; i++) {
    const stakingToken = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])
    const stakingRewardsContract = await deployContract(wallet, StakingRewards, [
      owner,
      stakingRewardsFactoryAddress,
      rewardsToken.address,
      stakingToken.address,
    ])
    stakingTokens.push(stakingToken)
    stakingRewardsContracts.push(stakingRewardsContract)
  }

  const { timestamp: now } = await provider.getBlock('latest')
  const reward = expandTo18Decimals(10)
  const stakingRewardsFactory = await deployContract(wallet, StakingRewardsFactory, [
    rewardsToken.address,
    stakingRewardsContracts.map((stakingRewardsContract) => stakingRewardsContract.address),
    now + 60 * 60,
    reward,
  ])
  expect(stakingRewardsFactory.address).to.be.eq(stakingRewardsFactoryAddress)

  return { rewardsToken, stakingTokens, stakingRewardsContracts, reward, stakingRewardsFactory }
}
