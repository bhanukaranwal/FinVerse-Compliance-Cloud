import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('broker_accounts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('broker_name').notNullable();
    table.string('account_id').notNullable();
    table.string('account_name').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.text('encrypted_credentials').notNullable();
    table.enum('sync_status', ['CONNECTED', 'DISCONNECTED', 'SYNCING', 'ERROR', 'PENDING_AUTH']).defaultTo('PENDING_AUTH');
    table.timestamp('last_sync_at').nullable();
    table.json('sync_metadata').defaultTo('{}');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['user_id']);
    table.index(['broker_name']);
    table.index(['sync_status']);
    table.unique(['user_id', 'broker_name', 'account_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('broker_accounts');
}