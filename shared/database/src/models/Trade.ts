import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('trades')
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  symbol: string;

  @Column()
  exchange: string;

  @Column()
  segment: string;

  @Column({ type: 'enum', enum: ['buy', 'sell'] })
  side: 'buy' | 'sell';

  @Column({ type: 'decimal', precision: 20, scale: 4 })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 4 })
  price: number;

  @Column({ type: 'decimal', precision: 20, scale: 4 })
  amount: number;

  @Column({ name: 'order_type' })
  orderType: string;

  @Column({ name: 'product_type' })
  productType: string;

  @Column({ name: 'trade_timestamp' })
  tradeTimestamp: Date;

  @Column()
  status: string;

  @Column({ type: 'decimal', precision: 20, scale: 4, default: 0 })
  brokerage: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, default: 0 })
  stt: number;

  @Column({ name: 'exchange_charge', type: 'decimal', precision: 20, scale: 4, default: 0 })
  exchangeCharge: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, default: 0 })
  gst: number;

  @Column({ name: 'sebi_charge', type: 'decimal', precision: 20, scale: 4, default: 0 })
  sebiCharge: number;

  @Column({ name: 'stamp_duty', type: 'decimal', precision: 20, scale: 4, default: 0 })
  stampDuty: number;

  @Column({ name: 'broker_order_id' })
  brokerOrderId: string;

  @Column({ name: 'broker_trade_id' })
  brokerTradeId: string;

  @Column({ nullable: true })
  isin?: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}