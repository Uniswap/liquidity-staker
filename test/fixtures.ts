import chai, { expect } from 'chai'
import { Contract, Wallet, BigNumber, providers } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utils'

import TestERC20 from '../build/TestERC20.json'
import StakingRewards from '../build/StakingRewards.json'
import StakingRewardsFactory from '../build/StakingRewardsFactory.json'

chai.use(solidity)

const NUMBER_OF_STAKING_TOKENS = 4

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
  genesis: number
  reward: BigNumber
  stakingRewardsFactory: Contract
}

export async function stakingRewardsFactoryFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<StakingRewardsFactoryFixture> {
  const owner = wallet.address
  const rewardsToken = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])

  // deploy staking tokens
  const stakingTokens = []
  for (let i = 0; i < NUMBER_OF_STAKING_TOKENS; i++) {
    const stakingToken = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])
    stakingTokens.push(stakingToken)
  }

  // get the counterfactual staking rewards factory address
  const stakingRewardsFactoryAddress = Contract.getContractAddress({ from: wallet.address, nonce: 9 })

  // deploy individual staking rewards contracts
  const stakingRewardsContracts = []
  for (let i = 0; i < 4; i++) {
    const stakingRewardsContract = await deployContract(wallet, StakingRewards, [
      owner,
      stakingRewardsFactoryAddress,
      rewardsToken.address,
      stakingTokens[i].address,
    ])
    stakingRewardsContracts.push(stakingRewardsContract)
  }

  // deploy the staking rewards factory
  const { timestamp: now } = await provider.getBlock('latest')
  const genesis = now + 60 * 60
  const reward = expandTo18Decimals(10)
  const stakingRewardsFactory = await deployContract(wallet, StakingRewardsFactory, [
    rewardsToken.address,
    stakingRewardsContracts.map((stakingRewardsContract) => stakingRewardsContract.address),
    genesis,
    reward,
  ])
  expect(stakingRewardsFactory.address).to.be.eq(stakingRewardsFactoryAddress)

  return { rewardsToken, stakingTokens, stakingRewardsContracts, genesis, reward, stakingRewardsFactory }
}
