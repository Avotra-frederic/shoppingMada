import Notification from "../model/notification.model";

export const createUserNotification = async (recipientId: unknown, data: { kind: string; title: string; message: string; targetType?: string; targetId?: string }) => {
  if (!recipientId) return null;
  try { return await Notification.create({ recipientId, ...data }); }
  catch (error) { console.error("Notification persistence failed", error); return null; }
};

export const notifyUserIfEnabled = async (recipient: any, data: { kind: string; title: string; message: string; targetType?: string; targetId?: string }) => {
  if (!recipient?._id) return null;
  const enabled = data.kind.startsWith("support") ? recipient.preferences?.notifications?.support !== false : recipient.preferences?.notifications?.orders !== false;
  if (!enabled) return null;
  return createUserNotification(recipient._id, data);
};
