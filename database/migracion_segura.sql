-- ============================================================
--  🌴 Riviera Maya — Migración segura (sin DROP)
--  Solo AGREGA columnas nuevas y tablas nuevas
--  Uso:  mysql -u root -p riviera_congresos < migracion_segura.sql
-- ============================================================

USE riviera_congresos;

-- ─────────────── CATÁLOGO DE SALONES (tabla nueva) ───────────────
CREATE TABLE IF NOT EXISTS salones (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  codigo    VARCHAR(20)   NOT NULL UNIQUE,
  nombre    VARCHAR(80)   NOT NULL,
  stock     INT           NOT NULL DEFAULT 1,
  capacidad INT           NOT NULL,
  costo_dia DECIMAL(10,2) NOT NULL,
  unico     TINYINT(1)    NOT NULL DEFAULT 1,
  activo    TINYINT(1)    NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO salones (codigo,nombre,stock,capacidad,costo_dia,unico) VALUES
  ('magno',  'Salón MAGNO',          1, 1000, 20000.00, 1),
  ('emp_a',  'Salón Empresarial A',  1,  300, 15000.00, 1),
  ('emp_b',  'Salón Empresarial B',  1,  300, 15000.00, 1),
  ('emp_c',  'Salón Empresarial C',  1,  200, 10000.00, 1),
  ('reunion','Salón de Reuniones',   6,   40,  5000.00, 0);

-- ─────────────── NUEVAS COLUMNAS EN congresos ───────────────
-- (usa ALTER TABLE ADD COLUMN ... solo si la columna no existe)
ALTER TABLE congresos
  ADD COLUMN IF NOT EXISTS organizador            VARCHAR(150)   NULL,
  ADD COLUMN IF NOT EXISTS tipo_congreso          ENUM('academico','empresarial','feria','seminario','productos') NOT NULL DEFAULT 'empresarial',
  ADD COLUMN IF NOT EXISTS imagen_url             VARCHAR(255)   NULL,
  ADD COLUMN IF NOT EXISTS cuota_recuperacion     DECIMAL(10,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cuota_turista          DECIMAL(10,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS msi                    INT            NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS modulos_stands         INT            NULL,
  ADD COLUMN IF NOT EXISTS incluye_talleres       TINYINT(1)     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incluye_conferencias   TINYINT(1)     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permite_subapartados   TINYINT(1)     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permite_postulacion    TINYINT(1)     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS costo_total_salones    DECIMAL(12,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estado_pago            ENUM('pendiente','parcial','liquidado') NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS monto_pagado           DECIMAL(12,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS multa_aplicada         DECIMAL(12,2)  NOT NULL DEFAULT 0;

-- Ampliar el enum 'estado' si es necesario (ADD COLUMN no lo toca si ya existe)
-- Verifica manualmente: SHOW COLUMNS FROM congresos WHERE Field='estado';
-- Si necesitas agregar valores al enum 'estado', hazlo con:
-- ALTER TABLE congresos MODIFY COLUMN estado 
--   ENUM('borrador','planeacion','activo','cerrado','cancelado') NOT NULL DEFAULT 'planeacion';

-- ─────────────── NUEVAS COLUMNAS EN inscripciones ───────────────
ALTER TABLE inscripciones
  ADD COLUMN IF NOT EXISTS monto_pagado  DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estado_pago   ENUM('pendiente','pagado','reembolsado') NOT NULL DEFAULT 'pendiente';

-- ─────────────── NUEVA COLUMNA EN proveedores_detalle ───────────────
-- Imagen de referencia de la empresa (se guarda como data URL base64).
ALTER TABLE proveedores_detalle
  ADD COLUMN IF NOT EXISTS imagen_url MEDIUMTEXT NULL;

-- ─────────────── SALONES RESERVADOS POR CONGRESO (tabla nueva) ───────────────
CREATE TABLE IF NOT EXISTS congreso_salones (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  congreso_id    INT NOT NULL,
  salon_id       INT NOT NULL,
  cantidad       INT NOT NULL DEFAULT 1,
  costo_dia_snap DECIMAL(10,2) NOT NULL,
  capacidad_snap INT NOT NULL,
  FOREIGN KEY (congreso_id) REFERENCES congresos(id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id)    REFERENCES salones(id),
  UNIQUE KEY uq_cong_salon (congreso_id, salon_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────── PROVEEDORES POR CONGRESO (tabla nueva) ───────────────
CREATE TABLE IF NOT EXISTS congreso_proveedores (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  congreso_id  INT NOT NULL,
  proveedor_id INT NOT NULL,
  origen       ENUM('invitado','postulado') NOT NULL DEFAULT 'invitado',
  estado       ENUM('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente',
  mensaje      TEXT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (congreso_id)  REFERENCES congresos(id) ON DELETE CASCADE,
  FOREIGN KEY (proveedor_id) REFERENCES proveedores_detalle(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cong_prov (congreso_id, proveedor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────── PAGOS (tabla nueva) ───────────────
CREATE TABLE IF NOT EXISTS pagos (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  congreso_id      INT NOT NULL,
  pagador_id       INT NOT NULL,
  concepto         ENUM('salones','multa','cuota_asistente') NOT NULL,
  metodo           ENUM('tarjeta','digital','pasarela') NOT NULL,
  monto            DECIMAL(12,2) NOT NULL,
  estado           ENUM('pendiente','pagado','reembolsado') NOT NULL DEFAULT 'pendiente',
  requiere_factura TINYINT(1) NOT NULL DEFAULT 0,
  rfc              VARCHAR(13)  NULL,
  razon_social     VARCHAR(150) NULL,
  uso_cfdi         VARCHAR(10)  NULL,
  factura_uuid     VARCHAR(60)  NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (congreso_id) REFERENCES congresos(id) ON DELETE CASCADE,
  FOREIGN KEY (pagador_id)  REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
