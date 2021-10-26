import { 
    BigintIsh, 
    MaxUint256, 
    Percent, 
    Price, 
    CurrencyAmount, 
    Token 
} from '@uniswap/sdk-core'
import Big from 'big.js'
import invariant from 'tiny-invariant'
import { ZERO } from '../internalConstants'


interface PositionConstructorArgs {
    collateralManager: CollateralManager
    market: Market
    collateral: Big
    isLong: boolean
    leverage: number
    debt: Big
    cost: Big
    oiShares: Big
    priceEntry: Big
}
  
export class Position {

    public readonly collateralManager: CollateralManager
    public readonly market: Market
    public readonly collateral: CurrencyAmount<Token> | null = null
    public readonly leverage: number | null = null
    public readonly isLong: boolean | null = null
    public readonly cost: Big | null = null
    public readonly debt: Big | null = null
    public readonly oiShares: Big | null = null
    public readonly priceEntry: Big | null = null
  
    /**
     * Constructs a position for a given pool with the given liquidity
     * @param pool For which pool the liquidity is assigned
     * @param liquidity The amount of liquidity that is in the position
     * @param tickLower The lower tick of the position
     * @param tickUpper The upper tick of the position
     */
    public constructor({ 
        collateralManager, 
        market,
        collateral, 
        leverage, 
        isLong,
        cost,
        debt,
        oiShares,
        priceEntry
    }: PositionConstructorArgs) {
  
      this.collateralManager = collateralManager
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
    ): Big {

        const oi = this.oi(totalOi, totalOiShares)

        const priceFrame = priceExit.div(this.priceEntry)

        if (this.isLong) {

            return oi.times(priceFrame)
                .lessThan(this.debt)

        } else {

            return oi.times(priceFrame).plus(this.debt)
                .lessThan(oi.times(Big(2)))

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

        if (value.equals(Big(0))) return Big.BigInt(Number.MAX_SAFE_INTEGER);

        const notional = this.notional(totalOi, totalOiShares, priceExit)

        return notional.divdBy(value)
    }

    public openMargin (
        totalOi: Big,
        totalOiShares: Big,
        priceExit: Big
    ): Big {

        const notional = this.notional(totalOi, totalOiShares, priceExit)

        if (notional.equal(ZERO)) return ZERO

        const value = this.value(totalOi, totalOiShares, priceExit)

        return value.div(notional)

    }

    public isLiquidatable (
        totalOi: Big,
        totalOiShares: Big,
        priceExit: Big,
        marginMaintenance: Big
    ): Big {

        const value = this.value(totalOi, totalOiShares, priceExit)

        const initialOi = this.initialOi()

        const maintenanceMargin = initialOi.times(marginMaintenance)

        return value.isLessThan(maintenanceMargin)

    }

    public liquidationPrice(
        totalOi: Big,
        totalOiShares: Big,
        marginMaintenance: Big
    ): Big {

        const oi = this.oi(totalOi, totalOiShares)

        const initialOi = this.initialOi()

        const oiFrame = initialOi
            .times(marginMaintenance)
            .plus(this.debt)
            .div(oi)

        if (this.isLong) return this.priceEntry.times(oiFrame)
        else return this.priceEntry.times(TWO.minus(oiFrame))

    }

  }