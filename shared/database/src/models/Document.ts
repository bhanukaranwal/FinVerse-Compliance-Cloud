import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User';

export enum DocumentType {
  PDF = 'PDF',
  IMAGE = 'IMAGE',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
  TEXT = 'TEXT',
  OTHER = 'OTHER',
}

export enum DocumentCategory {
  CONTRACT_NOTE = 'CONTRACT_NOTE',
  BANK_STATEMENT = 'BANK_STATEMENT',
  TAX_DOCUMENT = 'TAX_DOCUMENT',
  COMPLIANCE_DOCUMENT = 'COMPLIANCE_DOCUMENT',
  PORTFOLIO_STATEMENT = 'PORTFOLIO_STATEMENT',
  IDENTITY_DOCUMENT = 'IDENTITY_DOCUMENT',
  OTHER = 'OTHER',
}

@Entity('documents')
@Index(['userId'])
@Index(['type'])
@Index(['category'])
@Index(['createdAt'])
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: DocumentType,
  })
  type: DocumentType;

  @Column({
    type: 'enum',
    enum: DocumentCategory,
  })
  category: DocumentCategory;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column()
  path: string;

  @Column()
  url: string;

  @Column({ name: 'is_encrypted', default: false })
  isEncrypted: boolean;

  @Column({ type: 'jsonb', default: '[]' })
  tags: string[];

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @Column({ default: 1 })
  version: number;

  @Column({ name: 'parent_id', nullable: true })
  parentId?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}