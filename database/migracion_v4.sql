-- ============================================================
--  🌴 Riviera Maya — Migración v4 (aditiva, sin DROP)
--  Arregla el error "columna desconocida" al CREAR / LIQUIDAR un
--  congreso y agrega la imagen de referencia de los proveedores.
--
--  Causa: el backend (congresos.js) inserta y consulta las columnas
--  `cuota_turista` y `msi`, pero no existían en la tabla `congresos`.
--  Aquí se agregan de forma segura (solo si faltan).
--
--  Uso:  mysql -u root -p riviera_congresos < database/migracion_v4.sql
-- ============================================================
USE riviera_congresos;

-- ─────────────── CONGRESOS: columnas que faltaban ───────────────
-- (ADD COLUMN IF NOT EXISTS es seguro de re-ejecutar)
ALTER TABLE congresos
  ADD COLUMN IF NOT EXISTS cuota_turista DECIMAL(10,2) NOT NULL DEFAULT 0,  -- cuota de ingreso para turistas
  ADD COLUMN IF NOT EXISTS msi           INT           NOT NULL DEFAULT 0;  -- meses sin intereses (0 = contado)

-- La imagen promocional del congreso se guarda como data URL (base64);
-- aseguramos que la columna sea lo bastante grande para alojarla completa.
ALTER TABLE congresos MODIFY COLUMN imagen_url MEDIUMTEXT NULL;

-- ─────────────── PROVEEDORES: imagen de referencia ───────────────
-- Imagen de la empresa proveedora (se guarda como data URL base64).
ALTER TABLE proveedores_detalle
  ADD COLUMN IF NOT EXISTS imagen_url MEDIUMTEXT NULL;
