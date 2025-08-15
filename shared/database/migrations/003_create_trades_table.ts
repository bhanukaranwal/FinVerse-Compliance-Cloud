import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('trades', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('broker_account_id').notNullable().references('id').inTable('broker_accounts').onDelete('CASCADE');
    table.string('symbol').notNullable();
    table.string('exchange').notNullable();
    table.string('segment').notNullable();
    table.enum('side', ['buy', 'sell']).notNullable();
    table.decimal('quantity', 20, 4).notNullable();
    table.decimal('price', 20, 4).notNullable();
    table.decimal('amount', 20, 4).notNullable();
    table.string('order_type').notNullable();
    table.string('product_type').notNullable();
    table.timestamp('trade_timestamp').notNullable();
    table.string('status').notNullable();
    table.decimal('brokerage', 20, 4).defaultTo(0);
    table.decimal('stt', 20, 4).defaultTo(0);
    table.decimal('exchange_charge', 20, 4).defaultTo(0);
    table.decimal('gst', 20, 4).defaultTo(0);
    table.decimal('sebi_charge', 20, 4).defaultTo(0);
    table.decimal('stamp_duty', 20, 4).defaultTo(0);
    table.string('broker_order_id').notNullable();
    table.string('broker_trade_id').notNullable();
    table.string('isin').nullable();
    table.json('metadata').defaultTo('{}');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['user_id']);
    table.index(['broker_account_id']);
    table.index(['symbol']);
    table.index(['exchange']);
    table.index(['side']);
    table.index(['trade_timestamp']);
    table.index(['broker_order_id']);
    table.unique(['broker_account_id', 'broker_trade_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('trades');
}