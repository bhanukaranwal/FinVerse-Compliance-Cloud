import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User';

@Entity('broker_accounts')
@Index(['userId'])
@Index(['brokerName'])
export class BrokerAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'broker_name' })
  brokerName: string;

  @Column({ name: 'account_id' })
  accountId: string;

  @Column({ name: 'account_name' })
  accountName: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'encrypted_credentials', type: 'text' })
  encryptedCredentials: string;

  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: ['CONNECTED', 'DISCONNECTED', 'SYNCING', 'ERROR', 'PENDING_AUTH'],
    default: 'PENDING_AUTH',
  })
  syncStatus: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt?: Date;

  @Column({ name: 'sync_metadata', type: 'jsonb', default: '{}' })
  syncMetadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}