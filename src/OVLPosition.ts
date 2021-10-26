import { 
    CurrencyAmount, 
    Token 
} from '@uniswap/sdk-core'
import {
    OVLCollateral
} from './OverlayV1OVLCollateral'
import {
    UniswapV3Market
} from './OverlayV1UniswapV3Market'
import Big from 'big.js'
import invariant from 'tiny-invariant'
import { ZERO, TWO } from './constants'


interface PositionConstructorArgs {
    OVLCollateral: OVLCollateral
    market: UniswapV3Market
    collateral: Big
    isLong: boolean
    leverage: number
    debt: Big
    cost: Big
    oiShares: Big
    priceEntry: Big
}
  
export class OVLPosition {

    public readonly OVLCollateral: OVLCollateral
    public readonly market: UniswapV3Market
    public readonly collateral: CurrencyAmount<Token>
    public readonly leverage: number 
    public readonly isLong: boolean
    public readonly cost: Big
    public readonly debt: Big
    public readonly oiShares: Big
    public readonly priceEntry: Big
  
    /**
     * Constructs a position for a given pool with the given liquidity
     * @param pool For which pool the liquidity is assigned
     * @param liquidity The amount of liquidity that is in the position
     * @param tickLower The lower tick of the position
     * @param tickUpper The upper tick of the position
     */
    public constructor({ 
        OVLCollateral, 
        market,
        collateral, 
        leverage, 
        isLong,
        cost,
        debt,
        oiShares,
        priceEntry
    }: PositionConstructorArgs) {
  
      this.OVLCollateral = OVLCollateral
      this.market = market
      this.collateral = collateral
      this.leverage = leverage
      this.isLong = isLong
      this.cost = cost
      this.debt = debt
      this.oiShares = oiShares
      this.priceEntry = priceEntry

    }

    public oi (
        totalOi: Big,
        totalOiShares: Big
    ): Big {

        return this.oiShares.times(totalOi).div(totalOiShares)

    }

    public get initialOi (): Big {

        return this.cost.plus(this.debt);

    }

    public value (
        totalOi: Big,
        totalOiShares: Big,
        priceExit: Big
    ): Big {

        const oi = this.oi(totalOi, totalOiShares)
        const priceFrame = priceExit.div(this.priceEntry)

        let value
        if (this.isLong) {

            value = oi.times(priceFrame)
            value = value.minus(value.GE(this.debt) ? this.debt : value)

        } else {

            value = oi.div(Big(2))
            value = value.minus(
                value.GE(this.debt.plus(oi.times(priceFrame)))
                    ? this.debt.plus(oi.times(priceFrame))
                    : value
            )

        }

        return value 

    }

    public isUnderwater (
        totalOi: Big,
        totalOiShares: Big,
        priceExit: Big
    ): boolean {

        const oi = this.oi(totalOi, totalOiShares)

        const priceFrame = priceExit.div(this.priceEntry)

        if (this.isLong) {

            return oi.times(priceFrame)
                .lt(this.debt)

        } else {

            return oi.times(priceFrame).plus(this.debt)
                .lt(oi.times(Big(2)))

        }

    }

    public notional (
        totalOi: Big,
        totalOiShares: Big,
        priceExit: Big
    ): Big {

        const value = this.value(totalOi, totalOiShares, priceExit)

        return value.plus(this.debt)

    }

    public openLeverage (
        totalOi: Big,
        totalOiShares: Big,
        priceExit: Big
    ): Big {

        const value = this.value(totalOi, totalOiShares, priceExit)

        if (value.eq(Big(0))) return Big(Number.MAX_SAFE_INTEGER);

        const notional = this.notional(totalOi, totalOiShares, priceExit)

        return notional.div(value)
    }

    public openMargin (
        totalOi: Big,
        totalOiShares: Big,
        priceExit: Big
    ): Big {

        const notional = this.notional(totalOi, totalOiShares, priceExit)

        if (notional.eq(ZERO)) return ZERO

        const value = this.value(totalOi, totalOiShares, priceExit)

        return value.div(notional)

    }

    public isLiquidatable (
        totalOi: Big,
        totalOiShares: Big,
        priceExit: Big,
        marginMaintenance: Big
    ): boolean {

        const value = this.value(totalOi, totalOiShares, priceExit)

        const initialOi = this.initialOi

        const maintenanceMargin = initialOi.times(marginMaintenance)

        return value.lt(maintenanceMargin)

    }

    public liquidationPrice(
        totalOi: Big,
        totalOiShares: Big,
        marginMaintenance: Big
    ): Big {

        const oi = this.oi(totalOi, totalOiShares)

        const initialOi = this.initialOi

        const oiFrame = initialOi
            .times(marginMaintenance)
            .plus(this.debt )
            .div(oi)

        if (this.isLong) return this.priceEntry.times(oiFrame)
        else return this.priceEntry.times(TWO.minus(oiFrame))

    }

  }