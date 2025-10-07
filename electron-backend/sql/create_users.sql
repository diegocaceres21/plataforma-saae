-- Tabla de usuarios para autenticación
CREATE TABLE IF NOT EXISTS usuario (
  id SERIAL PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  password_hash VARCHAR(120) NOT NULL,
  rol VARCHAR(30) NOT NULL DEFAULT 'usuario',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agregar campo nombre si no existe (para actualizaciones)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuario' AND column_name='nombre') THEN
    ALTER TABLE usuario ADD COLUMN nombre VARCHAR(120) NOT NULL DEFAULT 'Usuario';
  END IF;
END $$;

-- Usuario inicial (reemplazar hash luego). Hash corresponde a contraseña: admin123
-- Generado con bcrypt saltRounds=10
INSERT INTO usuario (username, nombre, password_hash, rol) VALUES (
  'admin',
  'Administrador',
  '$2b$10$2O1quk5RJHn2dmbYWSr1OeJof1gVEOcScMDxfgPOwBfxr2DX6jh0K',
  'admin'
) ON CONFLICT (username) DO NOTHING;