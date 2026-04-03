-- Add new status to support soft deactivation of tables
ALTER TYPE "TableStatus" ADD VALUE IF NOT EXISTS 'DISABLED';
