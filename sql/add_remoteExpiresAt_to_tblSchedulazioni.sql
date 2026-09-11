-- Stores the exact remote promotion expiration as UTC epoch milliseconds.
-- The publisher also applies this change automatically at startup.

ALTER TABLE `tblSchedulazioni`
    ADD COLUMN `remoteExpiresAt` BIGINT NULL AFTER `dateTimeTop`;
