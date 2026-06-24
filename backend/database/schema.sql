-- backend/database/schema.sql
-- This script creates the database schema for the AI Personalized Message Generator.
-- It defines all 8 tables and seeds static lookup tables (occasions and tones).

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Create recipients table
CREATE TABLE IF NOT EXISTS recipients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    relationship VARCHAR(50) NOT NULL,
    important_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Create occasions table (Lookup Table)
CREATE TABLE IF NOT EXISTS occasions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(200)
) ENGINE=InnoDB;

-- Create tones table (Lookup Table)
CREATE TABLE IF NOT EXISTS tones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(200)
) ENGINE=InnoDB;

-- Create messages table (Core Table)
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    recipient_id INT NOT NULL,
    occasion_id INT NOT NULL,
    tone_id INT NOT NULL,
    relationship VARCHAR(50) NOT NULL,
    message_text TEXT NOT NULL,
    status ENUM('generated', 'saved', 'edited', 'linked') DEFAULT 'generated',
    ai_used BOOLEAN DEFAULT TRUE,
    gift_order_id INT NULL,
    greeting_card_id INT NULL,
    version_number INT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY (recipient_id) REFERENCES recipients(id) ON DELETE RESTRICT,
    FOREIGN KEY (occasion_id) REFERENCES occasions(id) ON DELETE RESTRICT,
    FOREIGN KEY (tone_id) REFERENCES tones(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Create message_versions table (Audit Log)
CREATE TABLE IF NOT EXISTS message_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    version_number INT NOT NULL,
    message_text TEXT NOT NULL,
    edited_by VARCHAR(100) DEFAULT 'customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Create gift_orders table
CREATE TABLE IF NOT EXISTS gift_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    occasion_id INT,
    status ENUM('pending', 'processing', 'dispatched', 'delivered') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (occasion_id) REFERENCES occasions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Create greeting_cards table
CREATE TABLE IF NOT EXISTS greeting_cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    card_type VARCHAR(50) NOT NULL,
    design_ref VARCHAR(100) NOT NULL,
    approved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA (Static Lookup Tables)
-- ============================================================

-- Seed occasions lookup data
INSERT INTO occasions (name, description) VALUES
('Birthday', 'Celebrating someone special on their birthday'),
('Anniversary', 'Marking a relationship or work milestone'),
('Thank You', 'Expressing gratitude for a kind act'),
('Corporate Gift', 'Professional gifting for business relationships'),
('Festival', 'Seasonal or cultural celebration greeting')
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- Seed tones lookup data
INSERT INTO tones (name, description) VALUES
('Warm', 'Friendly, affectionate, and personal'),
('Formal', 'Respectful and professional in tone'),
('Funny', 'Light-hearted, humorous, and playful'),
('Heartfelt', 'Deep, emotional, and sincere'),
('Professional', 'Corporate-appropriate and business-focused')
ON DUPLICATE KEY UPDATE description=VALUES(description);
