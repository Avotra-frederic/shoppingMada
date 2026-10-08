import crypto from "crypto";
import User from "../model/user.model";

const hashValue = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

const createAdminStepUpCode = async (userId: string) => {
  const now = new Date();
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { adminStepUpLastSentAt: { $exists: false } },
        { adminStepUpLastSentAt: { $lte: new Date(now.getTime() - 60_000) } },
      ],
    },
    {
      $set: {
        adminStepUpOtpHash: hashValue(`${userId}:${code}`),
        adminStepUpOtpExpiresAt: new Date(now.getTime() + 10 * 60_000),
        adminStepUpOtpAttempts: 0,
        adminStepUpLastSentAt: now,
      },
      $unset: { adminStepUpTokenHash: 1, adminStepUpTokenExpiresAt: 1 },
    },
    { new: true },
  ).select("email");
  return user ? { code, email: user.email } : null;
};

const verifyAdminStepUpCode = async (userId: string, code: string) => {
  const user = await User.findById(userId)
    .select("+adminStepUpOtpHash +adminStepUpOtpExpiresAt +adminStepUpOtpAttempts");
  const now = new Date();
  if (
    !user?.adminStepUpOtpHash ||
    !user.adminStepUpOtpExpiresAt ||
    user.adminStepUpOtpExpiresAt <= now ||
    (user.adminStepUpOtpAttempts ?? 0) >= 5
  ) return false;

  const expectedHash = hashValue(`${userId}:${code}`);
  const actual = Buffer.from(user.adminStepUpOtpHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    await User.updateOne(
      { _id: userId, adminStepUpOtpHash: user.adminStepUpOtpHash, adminStepUpOtpAttempts: { $lt: 5 } },
      { $inc: { adminStepUpOtpAttempts: 1 } },
    );
    return false;
  }

  const consumed = await User.findOneAndUpdate(
    {
      _id: userId,
      adminStepUpOtpHash: expectedHash,
      adminStepUpOtpExpiresAt: { $gt: now },
      adminStepUpOtpAttempts: { $lt: 5 },
    },
    { $unset: { adminStepUpOtpHash: 1, adminStepUpOtpExpiresAt: 1, adminStepUpOtpAttempts: 1 } },
    { new: true },
  ).select("_id");
  return Boolean(consumed);
};

const storeAdminStepUpToken = async (userId: string, token: string) =>
  User.updateOne(
    { _id: userId },
    {
      $set: {
        adminStepUpTokenHash: hashValue(token),
        adminStepUpTokenExpiresAt: new Date(Date.now() + 5 * 60_000),
      },
    },
  );

const consumeAdminStepUpToken = async (userId: string, token: string) => {
  const result = await User.updateOne(
    {
      _id: userId,
      adminStepUpTokenHash: hashValue(token),
      adminStepUpTokenExpiresAt: { $gt: new Date() },
    },
    { $unset: { adminStepUpTokenHash: 1, adminStepUpTokenExpiresAt: 1 } },
  );
  return result.modifiedCount === 1;
};

export {
  createAdminStepUpCode,
  verifyAdminStepUpCode,
  storeAdminStepUpToken,
  consumeAdminStepUpToken,
};
