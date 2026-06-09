-- ============================================================
--  🌴 Riviera Maya — Congresos Empresariales
--  Esquema completo de base de datos
--  Uso:  mysql -u root -p < database/schema.sql
-- ============================================================
CREATE DATABASE IF NOT EXISTS riviera_congresos
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE riviera_congresos;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS inscripciones;
DROP TABLE IF EXISTS ponencias;
DROP TABLE IF EXISTS congresos;
DROP TABLE IF EXISTS salones;
DROP TABLE IF EXISTS categorias_servicio;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS roles;
SET FOREIGN_KEY_CHECKS = 1;

-- ─────────────── ROLES ───────────────
CREATE TABLE roles (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;
INSERT INTO roles (id,nombre) VALUES
  (1,'coordinador'),(2,'autor'),(3,'proveedor'),(4,'cliente');

-- ─────────────── USUARIOS ───────────────
CREATE TABLE usuarios (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  rol_id           INT NOT NULL,
  nombre           VARCHAR(80)  NOT NULL,
  apellidos        VARCHAR(120) NULL,
  email            VARCHAR(150) NOT NULL UNIQUE,
  password_hash    VARCHAR(255) NOT NULL,
  telefono         VARCHAR(25)  NULL,
  activo           TINYINT(1)   NOT NULL DEFAULT 1,
  intentos_fallidos INT         NOT NULL DEFAULT 0,
  bloqueado_hasta  DATETIME     NULL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- ─────────────── CATEGORÍAS DE SERVICIO (proveedores) ───────────────
CREATE TABLE categorias_servicio (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL UNIQUE
) ENGINE=InnoDB;
INSERT INTO categorias_servicio (id,nombre) VALUES
  (1,'hospedaje'),(2,'gastronomia'),(3,'audiovisual'),
  (4,'traslados'),(5,'actividades'),(6,'otro');

-- ─────────────── CATÁLOGO DE SALONES ───────────────
CREATE TABLE salones (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  codigo    VARCHAR(20)   NOT NULL UNIQUE,
  nombre    VARCHAR(80)   NOT NULL,
  stock     INT           NOT NULL DEFAULT 1,    -- unidades disponibles
  capacidad INT           NOT NULL,              -- personas por unidad
  costo_dia DECIMAL(10,2) NOT NULL,              -- MXN por día por unidad
  unico     TINYINT(1)    NOT NULL DEFAULT 1,    -- 1=pieza única / 0=multi-unidad
  activo    TINYINT(1)    NOT NULL DEFAULT 1
) ENGINE=InnoDB;
INSERT INTO salones (codigo,nombre,stock,capacidad,costo_dia,unico) VALUES
  ('magno',  'Salón MAGNO',          1, 1000, 20000.00, 1),
  ('emp_a',  'Salón Empresarial A',  1,  300, 15000.00, 1),
  ('emp_b',  'Salón Empresarial B',  1,  300, 15000.00, 1),
  ('emp_c',  'Salón Empresarial C',  1,  200, 10000.00, 1),
  ('reunion','Salón de Reuniones',   6,   40,  5000.00, 0);

-- ─────────────── CONGRESOS ───────────────
CREATE TABLE congresos (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  nombre              VARCHAR(150) NOT NULL,
  organizador         VARCHAR(150) NULL,
  descripcion         TEXT NULL,
  tematica            VARCHAR(120) NULL,
  tipo_congreso       ENUM('academico','empresarial','feria','seminario','productos') NOT NULL DEFAULT 'empresarial',
  sede                VARCHAR(150) NULL,
  imagen_url          MEDIUMTEXT NULL,
  aforo_max           INT NOT NULL DEFAULT 0,
  cuota_recuperacion  DECIMAL(10,2) NOT NULL DEFAULT 0,
  cuota_turista       DECIMAL(10,2) NOT NULL DEFAULT 0,  -- cuota que paga un turista para ingresar
  msi                 INT NOT NULL DEFAULT 0,            -- meses sin intereses (0 = contado)
  modulos_stands      INT NULL,                       -- obligatorio si tipo != academico
  incluye_talleres        TINYINT(1) NOT NULL DEFAULT 0,
  incluye_conferencias    TINYINT(1) NOT NULL DEFAULT 0,
  permite_subapartados    TINYINT(1) NOT NULL DEFAULT 0,
  permite_postulacion     TINYINT(1) NOT NULL DEFAULT 1,
  costo_total_salones DECIMAL(12,2) NOT NULL DEFAULT 0,
  estado_pago         ENUM('pendiente','parcial','liquidado') NOT NULL DEFAULT 'pendiente',
  monto_pagado        DECIMAL(12,2) NOT NULL DEFAULT 0,
  multa_aplicada      DECIMAL(12,2) NOT NULL DEFAULT 0,
  coordinador_id      INT NOT NULL,
  fecha_inicio        DATE NOT NULL,
  fecha_fin           DATE NOT NULL,
  estado              ENUM('borrador','planeacion','activo','cerrado','cancelado','reembolsado') NOT NULL DEFAULT 'planeacion',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coordinador_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ─────────────── SALONES RESERVADOS POR CONGRESO ───────────────
CREATE TABLE congreso_salones (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  congreso_id    INT NOT NULL,
  salon_id       INT NOT NULL,
  cantidad       INT NOT NULL DEFAULT 1,
  costo_dia_snap DECIMAL(10,2) NOT NULL,   -- precio congelado al reservar
  capacidad_snap INT NOT NULL,
  FOREIGN KEY (congreso_id) REFERENCES congresos(id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id)    REFERENCES salones(id),
  UNIQUE KEY uq_cong_salon (congreso_id, salon_id)
) ENGINE=InnoDB;

-- ─────────────── PROVEEDORES (detalle de empresa) ───────────────
CREATE TABLE proveedores_detalle (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT NOT NULL,
  empresa      VARCHAR(120) NOT NULL,
  categoria_id INT NOT NULL,
  descripcion  TEXT NULL,
  sitio_web    VARCHAR(180) NULL,
  rfc          VARCHAR(13)  NULL,
  imagen_url   MEDIUMTEXT   NULL,   -- imagen de referencia de la empresa (data URL base64)
  FOREIGN KEY (usuario_id)   REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (categoria_id) REFERENCES categorias_servicio(id)
) ENGINE=InnoDB;

-- ─────────────── PROVEEDORES POR CONGRESO (asociación + postulación) ───────────────
CREATE TABLE congreso_proveedores (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  congreso_id  INT NOT NULL,
  proveedor_id INT NOT NULL,                          -- -> proveedores_detalle.id
  origen       ENUM('invitado','postulado') NOT NULL DEFAULT 'invitado',
  estado       ENUM('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente',
  mensaje      TEXT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (congreso_id)  REFERENCES congresos(id) ON DELETE CASCADE,
  FOREIGN KEY (proveedor_id) REFERENCES proveedores_detalle(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cong_prov (congreso_id, proveedor_id)
) ENGINE=InnoDB;

-- ─────────────── PONENCIAS ───────────────
CREATE TABLE ponencias (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  congreso_id INT NOT NULL,
  autor_id    INT NOT NULL,
  titulo      VARCHAR(180) NOT NULL,
  resumen     TEXT NULL,
  estado      ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  feedback    TEXT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (congreso_id) REFERENCES congresos(id) ON DELETE CASCADE,
  FOREIGN KEY (autor_id)    REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ─────────────── INSCRIPCIONES (asistentes) ───────────────
CREATE TABLE inscripciones (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  congreso_id  INT NOT NULL,
  cliente_id   INT NOT NULL,
  folio        VARCHAR(20) NOT NULL UNIQUE,
  monto_pagado DECIMAL(10,2) NOT NULL DEFAULT 0,
  estado_pago  ENUM('pendiente','pagado','reembolsado') NOT NULL DEFAULT 'pendiente',
  estado       ENUM('pendiente','confirmada','cancelada') NOT NULL DEFAULT 'pendiente',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (congreso_id) REFERENCES congresos(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id)  REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ─────────────── PAGOS (organizador y asistentes) ───────────────
CREATE TABLE pagos (
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
