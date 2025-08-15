import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').unique().notNullable();
    table.string('password').notNullable();
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.string('phone').nullable();
    table.string('pan_number').unique().notNullable();
    table.string('aadhaar_number').unique().nullable();
    table.enum('role', ['ADMIN', 'TRADER', 'ACCOUNTANT', 'AUDITOR', 'VIEWER']).defaultTo('TRADER');
    table.boolean('is_email_verified').defaultTo(false);
    table.boolean('is_active').defaultTo(true);
    table.boolean('mfa_enabled').defaultTo(false);
    table.text('mfa_secret').nullable();
    table.json('permissions').defaultTo('[]');
    table.json('preferences').defaultTo('{}');
    table.timestamp('last_login_at').nullable();
    table.timestamp('password_changed_at').nullable();
    table.timestamps(true, true);
    
    // Indexes
    table.index(['email']);
    table.index(['pan_number']);
    table.index(['role']);
    table.index(['is_active']);
    table.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('users');
}