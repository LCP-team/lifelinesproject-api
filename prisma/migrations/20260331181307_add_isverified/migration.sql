-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "lifeliners" ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false;
