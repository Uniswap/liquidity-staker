import { Contract, Wallet } from 'ethers'
import { deployContract } from 'ethereum-waffle'

// import { expandTo18Decimals, OVERRIDES } from './utilities'

import StakingRewards from '../build/StakingRewards.json'

interface StakingRewardsFixture {
  stakingRewards: Contract
}

export async function stakingRewardsFixture([wallet]: Wallet[]): Promise<StakingRewardsFixture> {
  const stakingRewards = await deployContract(wallet, StakingRewards, [
    wallet.address,
    wallet.address,
    wallet.address,
    wallet.address,
  ])
  return { stakingRewards }
}
