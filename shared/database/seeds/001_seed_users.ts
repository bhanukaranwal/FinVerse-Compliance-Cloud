import { Knex } from 'knex';
import bcrypt from 'bcrypt';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex('users').del();

  const hashedPassword = await bcrypt.hash('admin123', 12);

  // Inserts seed entries
  await knex('users').insert([
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'bhanu@finversecompliance.com',
      password: hashedPassword,
      first_name: 'Bhanu',
      last_name: 'Karanwal',
      phone: '+919876543210',
      pan_number: 'ABCDE1234F',
      role: 'ADMIN',
      is_email_verified: true,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'demo@finversecompliance.com',
      password: await bcrypt.hash('demo123', 12),
      first_name: 'Demo',
      last_name: 'User',
      phone: '+919876543211',
      pan_number: 'FGHIJ5678K',
      role: 'TRADER',
      is_email_verified: true,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
}