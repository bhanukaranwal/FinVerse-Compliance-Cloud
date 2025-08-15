import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Portfolio } from './Portfolio';

@Entity('holdings')
@Index(['portfolioId'])
@Index(['symbol'])
export class Holding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'portfolio_id' })
  portfolioId: string;

  @ManyToOne(() => Portfolio, portfolio => portfolio.holdings)
  @JoinColumn({ name: 'portfolio_id' })
  portfolio: Portfolio;

  @Column()
  symbol: string;

  @Column()
  exchange: string;

  @Column()
  isin: string;

  @Column({ type: 'decimal', precision: 20, scale: 4 })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, name: 'average_price' })
  averagePrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, name: 'current_price' })
  currentPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, name: 'market_value' })
  marketValue: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, name: 'invested_value' })
  investedValue: number;

  @Column({ type: 'decimal', precision: 20, scale: 4 })
  pnl: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'pnl_percentage' })
  pnlPercentage: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, name: 'collateral_quantity', default: 0 })
  collateralQuantity: number;

  @Column({ name: 'collateral_type', nullable: true })
  collateralType?: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}