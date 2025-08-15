import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('documents', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.enum('type', ['PDF', 'IMAGE', 'EXCEL', 'CSV', 'TEXT', 'OTHER']).notNullable();
    table.enum('category', [
      'CONTRACT_NOTE',
      'BANK_STATEMENT', 
      'TAX_DOCUMENT',
      'COMPLIANCE_DOCUMENT',
      'PORTFOLIO_STATEMENT',
      'IDENTITY_DOCUMENT',
      'OTHER'
    ]).notNullable();
    table.bigint('size').notNullable();
    table.string('mime_type').notNullable();
    table.text('path').notNullable();
    table.text('url').notNullable();
    table.boolean('is_encrypted').defaultTo(false);
    table.json('tags').defaultTo('[]');
    table.json('metadata').defaultTo('{}');
    table.integer('version').defaultTo(1);
    table.uuid('parent_id').nullable().references('id').inTable('documents');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    
    // Indexes
    table.index(['user_id']);
    table.index(['type']);
    table.index(['category']);
    table.index(['created_at']);
    table.index(['is_active']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('documents');
}