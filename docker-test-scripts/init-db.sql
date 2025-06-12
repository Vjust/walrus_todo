-- Initialize test database for WalTodo testing
CREATE DATABASE IF NOT EXISTS waltodo_test;

USE waltodo_test;

-- Create test tables if needed
CREATE TABLE IF NOT EXISTS test_todos (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test data
INSERT INTO test_todos (title, completed) VALUES 
    ('Test Todo 1', FALSE),
    ('Test Todo 2', TRUE),
    ('Test Todo 3', FALSE);

-- Grant permissions
GRANT ALL PRIVILEGES ON waltodo_test.* TO 'testuser'@'%';