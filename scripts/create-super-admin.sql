-- Create super-admin user
-- Password: admin123 (bcrypt hash)

-- First, check if user exists and update, or insert new
INSERT INTO users (email, name, password, role, country, created_at, updated_at)
VALUES (
  'superadmin@test.com',
  'Super Admin',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5OZz5L5KK', -- password: admin123
  'super-admin',
  'US',
  NOW(),
  NOW()
)
ON CONFLICT (email) 
DO UPDATE SET 
  password = EXCLUDED.password,
  role = 'super-admin',
  name = EXCLUDED.name,
  updated_at = NOW();

-- Verify the user was created
SELECT id, email, name, role, country FROM users WHERE email = 'superadmin@test.com';

