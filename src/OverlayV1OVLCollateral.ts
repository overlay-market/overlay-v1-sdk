import {
BigintIsh,
Percent,
Token,
CurrencyAmount,
validateAndParseAddress,
Currency,
NativeCurrency
} from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { Position } from './entities/position'
import { ONE, ZERO } from './internalConstants'
import { MethodParameters, toHex } from './utils/calldata'
import { Interface } from '@ethersproject/abi'
import { abi } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import { PermitOptions, SelfPermit } from './selfPermit'
import { ADDRESS_ZERO } from './constants'
import { Pool } from './entities'

const MaxUint128 = toHex(JSBI.subtract(JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(128)), JSBI.BigInt(1)))

// exports for external consumption
export type BigintIsh = JSBI | string | number

export interface UnwindSpecificOptions {
    shares: BigintIsh // the amount of position shares to unwind
}

export interface CommonExitOptions {
    positionId: BigintIsh // the id of position to liquidate
}

export type LiquidateOptions = CommonExitOptions

export type UnwindOptions = CommonExitOptions & UnwindSpecificOptions

export interface BuildOptions {
    market: string             // the market to create a position on
    leverage: BigintIsh        // leverage to take out position with
    collateral: BigintIsh      // OVL amount to take out position with
    isLong: boolean            // to take the short or the long side
    slippageTolerance: Percent // amount of market impact to allow
    deadline: BigintIsh        // time when position expires
}

export interface SafeTransferOptions {
    operator: string        // operator sending the erc1155 token
    sender: string          // account from which to send the erc1155 token
    recipient: string       // account to be receiving the erc1155 token
    positionId: BigintIsh   // id of erc1155 token being sent
    value: BigintIsh        // amount of erc1155 token to send
    data?: string           // optional parameter passing data to `onERC1155Received`
}

export interface SafeBatchTransferOptions {
    operator: string            // operator sending erc1155 tokens
    senders: string[]           // accounts from which to send erc1155 tokens
    recipients: string[]        // accounts to be receiving erc1155 tokens
    positionIds: BigintIsh[]    // ids of erc1155s tokens to send
    values: BigintIsh[]         // amounts of erc1155 tokens to send
    data?: string               // optional parameter passing data to `onERC1155Received`
}

export interface ERC1155PermitOptions {
    v: 0 | 1 | 27 | 28
    r: string
    s: string
    deadline: BigintIsh
    spender: string
}

export abstract class OVLCollateral extends SelfPermit {

    private constructor () { super() }

    private static encodeBuild(): string {
        return "yes"
    }

    private static encodeUnwind(): string {

    }

    private static encodeLiquidate(): string {

    }

    private static encodeSafeTransferFromParameters(): string {

    }

    private static encodeSafeBatchTransferFromParameters(): string {

    }

    public static buildParameters(): MethodParameters {

    }

    public static unwindParameters(): MethodParameters {

    }

    public static liquidateParameters(): MethodParameters {

    }

    public static safeTransferFromParameters(options: SafeTransferOptions): MethodParameters {

        const recipient = validateAndParseAddress(options.recipient)
        const sender = validateAndParseAddress(options.sender)
    
        let calldata: string
        if (options.data) {

            calldata = NonfungiblePositionManager.INTERFACE.encodeFunctionData(
                'safeTransferFrom(address,address,address,uint256,bytes)',
                [ sender, recipient, toHex(options.positionId), toHex(options.value), options.data ]
            )

        } else {

            calldata = NonfungiblePositionManager.INTERFACE.encodeFunctionData(
                'safeTransferFrom(address,address,uint256)', 
                [ sender, recipient, toHex(options.positionId), toHex(options.value) ]
            )

        }

        return {
            calldata: calldata,
            value: toHex(0)
        }

    }

    public static safeBatchTransferFromParameters(): MethodParameters {

    }

}

export abstract class NonfungiblePositionManager extends SelfPermit {
    public static INTERFACE: Interface = new Interface(abi)

/**
 * Cannot be constructed.
 */
private constructor() {
    super()
}

private static encodeCreate(pool: Pool): string {
    return NonfungiblePositionManager.INTERFACE.encodeFunctionData('createAndInitializePoolIfNecessary', [
    pool.token0.address,
    pool.token1.address,
    pool.fee,
    toHex(pool.sqrtRatioX96)
    ])
}

public static createCallParameters(pool: Pool): MethodParameters {
    return {
    calldata: this.encodeCreate(pool),
    value: toHex(0)
    }
}

public static addCallParameters(position: Position, options: AddLiquidityOptions): MethodParameters {
    invariant(JSBI.greaterThan(position.liquidity, ZERO), 'ZERO_LIQUIDITY')

    const calldatas: string[] = []

    // get amounts
    const { amount0: amount0Desired, amount1: amount1Desired } = position.mintAmounts

    // adjust for slippage
    const minimumAmounts = position.mintAmountsWithSlippage(options.slippageTolerance)
    const amount0Min = toHex(minimumAmounts.amount0)
    const amount1Min = toHex(minimumAmounts.amount1)

    const deadline = toHex(options.deadline)

    // create pool if needed
    if (isMint(options) && options.createPool) {
    calldatas.push(this.encodeCreate(position.pool))
    }

    // permits if necessary
    if (options.token0Permit) {
    calldatas.push(NonfungiblePositionManager.encodePermit(position.pool.token0, options.token0Permit))
    }
    if (options.token1Permit) {
    calldatas.push(NonfungiblePositionManager.encodePermit(position.pool.token1, options.token1Permit))
    }

    // mint
    if (isMint(options)) {
    const recipient: string = validateAndParseAddress(options.recipient)

    calldatas.push(
        NonfungiblePositionManager.INTERFACE.encodeFunctionData('mint', [
        {
            token0: position.pool.token0.address,
            token1: position.pool.token1.address,
            fee: position.pool.fee,
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            amount0Desired: toHex(amount0Desired),
            amount1Desired: toHex(amount1Desired),
            amount0Min,
            amount1Min,
            recipient,
            deadline
        }
        ])
    )
    } else {
    // increase
    calldatas.push(
        NonfungiblePositionManager.INTERFACE.encodeFunctionData('increaseLiquidity', [
        {
            tokenId: toHex(options.tokenId),
            amount0Desired: toHex(amount0Desired),
            amount1Desired: toHex(amount1Desired),
            amount0Min,
            amount1Min,
            deadline
        }
        ])
    )
    }

    let value: string = toHex(0)

    if (options.useNative) {
    const wrapped = options.useNative.wrapped
    invariant(position.pool.token0.equals(wrapped) || position.pool.token1.equals(wrapped), 'NO_WETH')

    const wrappedValue = position.pool.token0.equals(wrapped) ? amount0Desired : amount1Desired

    // we only need to refund if we're actually sending ETH
    if (JSBI.greaterThan(wrappedValue, ZERO)) {
        calldatas.push(NonfungiblePositionManager.INTERFACE.encodeFunctionData('refundETH'))
    }

    value = toHex(wrappedValue)
    }

    return {
    calldata:
        calldatas.length === 1
        ? calldatas[0]
        : NonfungiblePositionManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
    value
    }
}

private static encodeCollect(options: CollectOptions): string[] {
    const calldatas: string[] = []

    const tokenId = toHex(options.tokenId)

    const involvesETH =
    options.expectedCurrencyOwed0.currency.isNative || options.expectedCurrencyOwed1.currency.isNative

    const recipient = validateAndParseAddress(options.recipient)

    // collect
    calldatas.push(
    NonfungiblePositionManager.INTERFACE.encodeFunctionData('collect', [
        {
        tokenId,
        recipient: involvesETH ? ADDRESS_ZERO : recipient,
        amount0Max: MaxUint128,
        amount1Max: MaxUint128
        }
    ])
    )

    if (involvesETH) {
    const ethAmount = options.expectedCurrencyOwed0.currency.isNative
        ? options.expectedCurrencyOwed0.quotient
        : options.expectedCurrencyOwed1.quotient
    const token = options.expectedCurrencyOwed0.currency.isNative
        ? (options.expectedCurrencyOwed1.currency as Token)
        : (options.expectedCurrencyOwed0.currency as Token)
    const tokenAmount = options.expectedCurrencyOwed0.currency.isNative
        ? options.expectedCurrencyOwed1.quotient
        : options.expectedCurrencyOwed0.quotient

    calldatas.push(
        NonfungiblePositionManager.INTERFACE.encodeFunctionData('unwrapWETH9', [toHex(ethAmount), recipient])
    )
    calldatas.push(
        NonfungiblePositionManager.INTERFACE.encodeFunctionData('sweepToken', [
        token.address,
        toHex(tokenAmount),
        recipient
        ])
    )
    }

    return calldatas
}

public static collectCallParameters(options: CollectOptions): MethodParameters {
    const calldatas: string[] = NonfungiblePositionManager.encodeCollect(options)

    return {
    calldata:
        calldatas.length === 1
        ? calldatas[0]
        : NonfungiblePositionManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
    value: toHex(0)
    }
}

/**
 * Produces the calldata for completely or partially exiting a position
 * @param position The position to exit
 * @param options Additional information necessary for generating the calldata
 * @returns The call parameters
 */
public static removeCallParameters(position: Position, options: RemoveLiquidityOptions): MethodParameters {
    const calldatas: string[] = []

    const deadline = toHex(options.deadline)
    const tokenId = toHex(options.tokenId)

    // construct a partial position with a percentage of liquidity
    const partialPosition = new Position({
    pool: position.pool,
    liquidity: options.liquidityPercentage.multiply(position.liquidity).quotient,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper
    })
    invariant(JSBI.greaterThan(partialPosition.liquidity, ZERO), 'ZERO_LIQUIDITY')

    // slippage-adjusted underlying amounts
    const { amount0: amount0Min, amount1: amount1Min } = partialPosition.burnAmountsWithSlippage(
    options.slippageTolerance
    )

    if (options.permit) {
    calldatas.push(
        NonfungiblePositionManager.INTERFACE.encodeFunctionData('permit', [
        validateAndParseAddress(options.permit.spender),
        tokenId,
        toHex(options.permit.deadline),
        options.permit.v,
        options.permit.r,
        options.permit.s
        ])
    )
    }

    // remove liquidity
    calldatas.push(
    NonfungiblePositionManager.INTERFACE.encodeFunctionData('decreaseLiquidity', [
        {
        tokenId,
        liquidity: toHex(partialPosition.liquidity),
        amount0Min: toHex(amount0Min),
        amount1Min: toHex(amount1Min),
        deadline
        }
    ])
    )

    const { expectedCurrencyOwed0, expectedCurrencyOwed1, ...rest } = options.collectOptions
    calldatas.push(
    ...NonfungiblePositionManager.encodeCollect({
        tokenId: toHex(options.tokenId),
        // add the underlying value to the expected currency already owed
        expectedCurrencyOwed0: expectedCurrencyOwed0.add(
        CurrencyAmount.fromRawAmount(expectedCurrencyOwed0.currency, amount0Min)
        ),
        expectedCurrencyOwed1: expectedCurrencyOwed1.add(
        CurrencyAmount.fromRawAmount(expectedCurrencyOwed1.currency, amount1Min)
        ),
        ...rest
    })
    )

    if (options.liquidityPercentage.equalTo(ONE)) {
    if (options.burnToken) {
        calldatas.push(NonfungiblePositionManager.INTERFACE.encodeFunctionData('burn', [tokenId]))
    }
    } else {
    invariant(options.burnToken !== true, 'CANNOT_BURN')
    }

    return {
    calldata: NonfungiblePositionManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
    value: toHex(0)
    }
}

public static safeTransferFromParameters(options: SafeTransferOptions): MethodParameters {
    const recipient = validateAndParseAddress(options.recipient)
    const sender = validateAndParseAddress(options.sender)

    let calldata: string
    if (options.data) {
    calldata = NonfungiblePositionManager.INTERFACE.encodeFunctionData(
        'safeTransferFrom(address,address,uint256,bytes)',
        [sender, recipient, toHex(options.tokenId), options.data]
    )
    } else {
    calldata = NonfungiblePositionManager.INTERFACE.encodeFunctionData('safeTransferFrom(address,address,uint256)', [
        sender,
        recipient,
        toHex(options.tokenId)
    ])
    }
    return {
    calldata: calldata,
    value: toHex(0)
    }
}
}