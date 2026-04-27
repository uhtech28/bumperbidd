import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Body of POST /auctions/:id/bids — the amount is in paisa (integer, not
 * rupees). Validating on the controller cheap-gates obviously malformed
 * input before it reaches the Redis Lua script.
 */
export class PlaceBidDto {
  @Type(() => Number)
  @IsInt({ message: 'amount must be an integer in paisa' })
  @Min(100, { message: 'amount must be at least 1 rupee (100 paisa)' })
  amount!: number;
}
