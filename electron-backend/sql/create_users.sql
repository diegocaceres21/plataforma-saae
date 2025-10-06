-- Tabla de usuarios para autenticación
CREATE TABLE IF NOT EXISTS usuario (
  id SERIAL PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(120) NOT NULL,
  rol VARCHAR(30) NOT NULL DEFAULT 'usuario',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Usuario inicial (reemplazar hash luego). Hash corresponde a contraseña: admin123
-- Generado con bcrypt saltRounds=10
INSERT INTO usuario (username, password_hash, rol) VALUES (
  'admin',
  '$2b$10$2O1quk5RJHn2dmbYWSr1OeJof1gVEOcScMDxfgPOwBfxr2DX6jh0K',
  'admin'
) ON CONFLICT (username) DO NOTHING;