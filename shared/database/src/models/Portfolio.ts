import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('portfolios')
export class Portfolio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 20, scale: 4, name: 'total_value' })
  totalValue: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, name: 'total_invested' })
  totalInvested: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, name: 'total_pnl' })
  totalPnl: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'total_pnl_percentage' })
  totalPnlPercentage: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'risk_score', default: 50 })
  riskScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'diversification_score', default: 50 })
  diversificationScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}