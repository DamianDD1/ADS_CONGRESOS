-- ============================================================
--  🌴 Riviera Maya — Migración v2 (aditiva, sin DROP)
--  Turista/Cliente · cuota turista · MSI · empresa representada
--  Uso:  mysql -u root -p riviera_congresos < migracion_v2.sql
-- ============================================================
USE riviera_congresos;

-- Cuota que define el coordinador para que un TURISTA entre al congreso,
-- y meses sin intereses ofrecidos en el pago.
ALTER TABLE congresos
  ADD COLUMN IF NOT EXISTS cuota_turista DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS msi           INT           NOT NULL DEFAULT 0;  -- 0 = sin MSI

-- Distinción turista/cliente y empresa representada en cada inscripción.
ALTER TABLE inscripciones
  ADD COLUMN IF NOT EXISTS tipo_asistente      ENUM('cliente','turista') NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS empresa_representada VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS brazalete           VARCHAR(20)  NULL;

-- La imagen promocional se guarda como data URL (base64); VARCHAR(255) la truncaba
-- y por eso "no salían". Se amplía para alojar la imagen completa.
ALTER TABLE congresos MODIFY COLUMN imagen_url MEDIUMTEXT NULL;
