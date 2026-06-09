-- ============================================================
--  🌴 Riviera Maya — Migración v7 (aditiva, sin DROP)
--  Recuperación de contraseña:
--   · reset_token   → código temporal para restablecer la contraseña
--   · reset_expira  → fecha/hora en que ese código deja de ser válido
--
--  Uso:  mysql -u root -p riviera_congresos < database/migracion_v7.sql
-- ============================================================
USE riviera_congresos;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS reset_token  VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS reset_expira DATETIME    NULL;
