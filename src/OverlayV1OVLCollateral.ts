import {
    validateAndParseAddress,
} from './utils/validateAndParseAddress'
import { Interface } from '@ethersproject/abi'
import { BigNumber } from '@ethersproject/bignumber'
import { abi } from './abis/OverlayV1OVLCollateral.json'
// import { PermitOptions, SelfPermit } from './selfPermit'
import Big from 'big.js'

export interface UnwindSpecificOptions {
    shares: Big // the amount of position shares to unwind
}

export interface CommonExitOptions {
    positionId: Big // the id of position to liquidate
}

export type LiquidateOptions = CommonExitOptions

export type UnwindOptions = CommonExitOptions & UnwindSpecificOptions

export interface BuildOptions {
    market: string             // the market to create a position on
    leverage: Big              // leverage to take out position with
    collateral: Big            // OVL amount to take out position with
    isLong: boolean            // to take the short or the long side
    slippageTolerance: number  // amount of market impact to allow
    deadline: Big              // time when position expires
}

export interface SafeTransferOptions {
    operator: string        // operator sending the erc1155 token
    sender: string          // account from which to send the erc1155 token
    recipient: string       // account to be receiving the erc1155 token
    positionId: number      // id of erc1155 token being sent
    value: Big              // amount of erc1155 token to send
    data?: string           // optional parameter passing data to `onERC1155Received`
}

export interface SafeBatchTransferOptions {
    operator: string            // operator sending erc1155 tokens
    senders: string[]           // accounts from which to send erc1155 tokens
    recipients: string[]        // accounts to be receiving erc1155 tokens
    positionIds: number[]       // ids of erc1155s tokens to send
    values: Big[]               // amounts of erc1155 tokens to send
    data?: string               // optional parameter passing data to `onERC1155Received`
}

export interface ERC1155PermitOptions {
    v: 0 | 1 | 27 | 28
    r: string
    s: string
    deadline: number
    spender: string
}

// export abstract class OVLCollateral extends SelfPermit {
export abstract class OVLCollateral {

    public static INTERFACE: Interface = new Interface(abi)

    // private constructor () { super() }
    private constructor () { }

    public static buildParameters(options: BuildOptions): string {

        console.log('BigNumberish log: ', BigNumber.from('4'))
        
        return OVLCollateral.INTERFACE.encodeFunctionData(
            'build', [
                validateAndParseAddress(options.market),
                options.collateral,
                options.leverage,
                options.isLong
            ])


    }

    public static unwindParameters(options: UnwindOptions): string {

        return OVLCollateral.INTERFACE.encodeFunctionData(
            'unwind', [
                options.positionId,
                options.shares
            ])

    }

    public static liquidateParameters(options: LiquidateOptions): string {

        return OVLCollateral.INTERFACE.encodeFunctionData(
            'liquidate', [ options.positionId ])

    }

    public static safeTransferFromParameters(options: SafeTransferOptions): string {

        const operator = validateAndParseAddress(options.operator)
        const recipient = validateAndParseAddress(options.recipient)
        const sender = validateAndParseAddress(options.sender)
    
        return OVLCollateral.INTERFACE.encodeFunctionData(
            'safeTransferFrom', [   
                operator, 
                sender, 
                recipient, 
                options.positionId, 
                options.value, 
                options.data 
            ]
        )

    }

    public static safeBatchTransferFromParameters(options: SafeBatchTransferOptions): string {

        const operator = validateAndParseAddress(options.operator)
        const recipients = options.recipients.map(addr => validateAndParseAddress(addr))
        const senders = options.senders.map(addr => validateAndParseAddress(addr))
        const positionIds = options.positionIds.map(id => id)
        const values = options.values.map(val => val)

        return OVLCollateral.INTERFACE.encodeFunctionData(
            'safeBatchTransferFrom', [ 
                operator, 
                senders, 
                recipients, 
                positionIds, 
                values, 
                options.data 
            ]
        )

    }

}
