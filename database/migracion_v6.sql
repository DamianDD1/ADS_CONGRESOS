-- ============================================================
--  🌴 Riviera Maya — Migración v6 (aditiva, sin DROP)
--  Hospedaje del complejo turístico:
--   · Tipo de cuenta (cliente de empresa / turista) y validación
--     de empresa con convenio (corroboración del cliente).
--   · Catálogo de tipos de habitación (datos de la ficha del hotel).
--   · Reservas de habitación (habitación estándar por defecto del
--     cliente, mejoras de nivel y extensión de noches).
--
--  Uso:  mysql -u root -p riviera_congresos < database/migracion_v6.sql
-- ============================================================
USE riviera_congresos;

-- ─────────────── USUARIOS: tipo de cuenta + empresa ───────────────
-- Un CLIENTE viene de parte de una empresa (se valida con un código de
-- convenio). Un TURISTA no pertenece a ninguna empresa.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS tipo_cuenta       ENUM('cliente','turista') NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS empresa           VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS empresa_validada  TINYINT(1)   NOT NULL DEFAULT 0;

-- ─────────────── EMPRESAS CON CONVENIO ───────────────
-- Sirven para corroborar que un cliente realmente viene de una empresa:
-- al registrarse debe capturar el código que su empresa le entregó.
CREATE TABLE IF NOT EXISTS empresas_convenio (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  nombre  VARCHAR(150) NOT NULL,
  rfc     VARCHAR(13)  NULL,
  codigo  VARCHAR(40)  NOT NULL UNIQUE,  -- código de validación del convenio
  activo  TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO empresas_convenio (nombre, rfc, codigo) VALUES
  ('Grupo Aeroméxico',      'AME920101AB1', 'AEROMEXICO-2026'),
  ('CEMEX',                 'CEM930215XY2', 'CEMEX-2026'),
  ('Grupo Bimbo',           'BIM850612KL3', 'BIMBO-2026'),
  ('Teléfonos de México',   'TEL840101MN4', 'TELMEX-2026'),
  ('Petróleos Mexicanos',   'PEM380607QR5', 'PEMEX-2026'),
  ('Instituto Politécnico Nacional', 'IPN360101IP0', 'IPN-2026');

-- ─────────────── CATÁLOGO DE TIPOS DE HABITACIÓN ───────────────
-- 180 habitaciones · capacidad máxima 516 huéspedes.
CREATE TABLE IF NOT EXISTS tipos_habitacion (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  codigo       VARCHAR(24)   NOT NULL UNIQUE,
  nombre       VARCHAR(80)   NOT NULL,
  descripcion  VARCHAR(400)  NULL,
  capacidad    INT           NOT NULL,            -- personas por habitación
  precio_noche DECIMAL(10,2) NOT NULL,            -- MXN por noche (temporada baja)
  stock        INT           NOT NULL,            -- nº de habitaciones de este tipo
  deposito_pct INT           NOT NULL DEFAULT 0,  -- % de depósito al reservar
  nivel        INT           NOT NULL DEFAULT 1,  -- orden para mejorar (1=estándar … 6=presidencial)
  edificio     VARCHAR(60)   NULL,
  activo       TINYINT(1)    NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO tipos_habitacion
  (codigo, nombre, descripcion, capacidad, precio_noche, stock, deposito_pct, nivel) VALUES
  ('estandar',            'Estándar',
   '2 personas · una cama matrimonial y una individual.',
   2, 1800.00, 70, 0, 1),
  ('doble',               'Doble',
   '4 personas · cada habitación cuenta con dos camas matrimoniales.',
   4, 2500.00, 40, 0, 2),
  ('vista_mar',           'Vista al Mar (Premium)',
   'Habitación premium para 2 personas · mitad cama matrimonial y mitad individual, con vista al mar.',
   2, 3200.00, 30, 0, 3),
  ('suite_junior',        'Suite Junior',
   '3 personas · una cama matrimonial y una individual.',
   3, 4200.00, 20, 0, 4),
  ('suite_ejecutiva',     'Suite Ejecutiva',
   '2 personas · dos camas matrimoniales, sala, mini bar, balcón y cocineta. Solo 12 disponibles.',
   2, 5500.00, 12, 0, 5),
  ('suite_presidencial',  'Suite Presidencial',
   '8 personas · sala-comedor, jacuzzi, terraza privada, dos camas King Size y un sofá-cama matrimonial. Requiere depósito del 30% al reservar.',
   8, 9000.00, 8, 30, 6);

-- ─────────────── RESERVAS DE HABITACIÓN ───────────────
CREATE TABLE IF NOT EXISTS reservas_habitacion (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id         INT NOT NULL,
  tipo_habitacion_id INT NOT NULL,
  folio              VARCHAR(20) NOT NULL UNIQUE,
  noches             INT NOT NULL DEFAULT 1,
  huespedes          INT NOT NULL DEFAULT 1,
  fecha_inicio       DATE NULL,
  temporada          ENUM('baja','media','alta','oficial') NOT NULL DEFAULT 'baja',
  precio_noche_snap  DECIMAL(10,2) NOT NULL,   -- precio/noche ya ajustado por temporada
  total              DECIMAL(12,2) NOT NULL,
  deposito           DECIMAL(12,2) NOT NULL DEFAULT 0,
  origen             ENUM('default','comprada') NOT NULL DEFAULT 'comprada', -- default = estándar asignada al cliente
  estado             ENUM('activa','cancelada') NOT NULL DEFAULT 'activa',
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id)         REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (tipo_habitacion_id) REFERENCES tipos_habitacion(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
