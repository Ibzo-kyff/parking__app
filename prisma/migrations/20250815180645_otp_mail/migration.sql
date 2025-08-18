-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifyOTP" TEXT,
ADD COLUMN     "emailVerifyOTPExpires" TIMESTAMP(3),
ADD COLUMN     "passwordResetOTPExpires" TIMESTAMP(3);
