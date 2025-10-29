-- Fix super-admin password with correct bcrypt hash for 'admin123'
UPDATE users 
SET password = '$2b$12$LFZaw2wsiSHOANk7V5JF7ejiMUmZg7hyuBh8oLfxvyD5cCzXwNubm'
WHERE email = 'superadmin@test.com';

-- Verify
SELECT email, name, role, 
       CASE WHEN password IS NOT NULL THEN 'Password SET' ELSE 'Password NULL' END as pwd_status,
       LENGTH(password) as pwd_length
FROM users 
WHERE email = 'superadmin@test.com';

