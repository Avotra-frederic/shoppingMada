import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { Types } from "mongoose";
import path from "path";
import { get_user_group_name } from "../service/user_group_member.service";
import { recordAdminAction } from "../service/admin-audit.service";
import Product from "../model/product.model";
import FacebookPageConnection from "../model/facebook-page-connection.model";
import FacebookOAuthTransaction from "../model/facebook-oauth-transaction.model";
import FacebookPublication from "../model/facebook-publication.model";

const graphVersion = () => (process.env.META_GRAPH_API_VERSION || "v26.0").replace(/^v?/, "v");
const graphBase = () => `https://graph.facebook.com/${graphVersion()}`;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const admin = async (req: Request, res: Response) => {
  const actor = (req as any).user;
  if (!actor?._id || await get_user_group_name({ user_id: new Types.ObjectId(String(actor._id)) }) !== "Super Admin") {
    res.status(403).json({ status: "Failed", message: "Accès réservé au Super Admin." });
    return null;
  }
  return actor;
};
const encryptionKey = () => {
  const key = process.env.META_TOKEN_ENCRYPTION_KEY || "";
  if (!/^[a-f\d]{64}$/i.test(key)) throw new Error("META_TOKEN_ENCRYPTION_KEY doit contenir 64 caractères hexadécimaux.");
  return Buffer.from(key, "hex");
};
const encrypt = (plainText: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${encrypted.toString("hex")}`;
};
const decrypt = (cipherText: string) => {
  const [ivHex, tagHex, dataHex] = cipherText.split(".");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
};
const frontendUrl = () => (process.env.META_FRONTEND_URL || process.env.ALLOWED_ORIGIN || "").split(",")[0].trim().replace(/\/$/, "");
const redirectUri = () => process.env.META_REDIRECT_URI || `${(process.env.BACKEND_PUBLIC_URL || "").replace(/\/$/, "")}/api/v1/admin/facebook/oauth/callback`;
const graphJson = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error?.message || `Meta Graph API (${response.status})`);
  return data;
};

export const facebookStatus = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!await admin(req, res)) return;
  const page: any = await FacebookPageConnection.findOne({ connectionKey: "primary" }).select("pageId pageName connectedAt updatedAt").lean();
  const count = page ? await FacebookPublication.countDocuments({ pageId: page.pageId, status: "published" }) : 0;
  const configured = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && /^[a-f\d]{64}$/i.test(process.env.META_TOKEN_ENCRYPTION_KEY || "") && redirectUri().startsWith("https://") && frontendUrl().startsWith("https://") && (process.env.BACKEND_PUBLIC_URL || "").startsWith("https://") && (process.env.SHOPINMADA_PUBLIC_URL || "").startsWith("https://"));
  res.json({ status: "Success", configured, page, publishedCount: count });
});

export const facebookConnectStart = expressAsyncHandler(async (req: Request, res: Response) => {
  const actor = await admin(req, res); if (!actor) return;
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET || !/^[a-f\d]{64}$/i.test(process.env.META_TOKEN_ENCRYPTION_KEY || "") || !frontendUrl().startsWith("https://") || !redirectUri().startsWith("https://") || !(process.env.BACKEND_PUBLIC_URL || "").startsWith("https://") || !(process.env.SHOPINMADA_PUBLIC_URL || "").startsWith("https://")) {
    res.status(503).json({ status: "Failed", message: "La configuration Meta est incomplète ou l’URL de callback n’est pas en HTTPS." }); return;
  }
  encryptionKey();
  const state = randomBytes(32).toString("base64url");
  await FacebookOAuthTransaction.create({ stateHash: hash(state), adminId: actor._id, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
  const params = new URLSearchParams({ client_id: process.env.META_APP_ID, redirect_uri: redirectUri(), state, response_type: "code", scope: "pages_show_list,pages_read_engagement,pages_manage_posts" });
  res.json({ status: "Success", url: `https://www.facebook.com/${graphVersion()}/dialog/oauth?${params.toString()}` });
});

export const facebookOAuthCallback = expressAsyncHandler(async (req: Request, res: Response) => {
  const base = frontendUrl();
  const fail = (code: string) => res.redirect(`${base}/espace_vendeur/facebook?meta_error=${encodeURIComponent(code)}`);
  if (!base || typeof req.query.state !== "string") { fail("oauth_invalid"); return; }
  const transaction: any = await FacebookOAuthTransaction.findOne({ stateHash: hash(req.query.state), expiresAt: { $gt: new Date() } });
  if (!transaction) { fail("oauth_expired"); return; }
  if (req.query.error || typeof req.query.code !== "string") { await transaction.deleteOne(); fail("oauth_denied"); return; }
  try {
    transaction.stateHash = hash(randomBytes(32).toString("hex"));
    await transaction.save();
    const appId = process.env.META_APP_ID || ""; const appSecret = process.env.META_APP_SECRET || "";
    if (!appId || !appSecret) throw new Error("Meta OAuth non configuré.");
    const exchange = await graphJson(`${graphBase()}/oauth/access_token?${new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri(), code: req.query.code })}`);
    const longLived = await graphJson(`${graphBase()}/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: exchange.access_token })}`);
    const result = await graphJson(`${graphBase()}/me/accounts?${new URLSearchParams({ fields: "id,name,access_token,tasks", limit: "100", access_token: longLived.access_token })}`);
    const candidates = (result.data || []).filter((page: any) => page.id && page.name && page.access_token).map((page: any) => ({ pageId: String(page.id), pageName: String(page.name), tasks: (page.tasks || []).map(String), encryptedAccessToken: encrypt(String(page.access_token)) }));
    if (!candidates.length) { await transaction.deleteOne(); fail("no_managed_pages"); return; }
    const handoff = randomBytes(32).toString("base64url");
    transaction.candidates = candidates; transaction.handoffHash = hash(handoff); await transaction.save();
    res.redirect(`${base}/espace_vendeur/facebook?meta_flow=${encodeURIComponent(handoff)}`);
  } catch (error) {
    console.error("Meta OAuth callback failed", error instanceof Error ? error.message : "unknown error");
    await transaction.deleteOne(); fail("oauth_failed");
  }
});

export const facebookConnectCandidates = expressAsyncHandler(async (req: Request, res: Response) => {
  const actor = await admin(req, res); if (!actor) return;
  const flow = typeof req.params.flow === "string" ? req.params.flow : "";
  const transaction: any = await FacebookOAuthTransaction.findOne({ adminId: actor._id, handoffHash: hash(flow), expiresAt: { $gt: new Date() } }).lean();
  if (!transaction) { res.status(404).json({ status: "Failed", message: "La connexion Meta a expiré. Recommencez." }); return; }
  res.json({ status: "Success", data: (transaction.candidates || []).map((candidate: any) => ({ pageId: candidate.pageId, pageName: candidate.pageName, tasks: candidate.tasks })) });
});

export const facebookConnectSelect = expressAsyncHandler(async (req: Request, res: Response) => {
  const actor = await admin(req, res); if (!actor) return;
  const flow = typeof req.params.flow === "string" ? req.params.flow : "";
  const pageId = typeof req.body?.pageId === "string" ? req.body.pageId : "";
  const transaction = await FacebookOAuthTransaction.findOne({ adminId: actor._id, handoffHash: hash(flow), expiresAt: { $gt: new Date() } });
  if (!transaction) { res.status(404).json({ status: "Failed", message: "La connexion Meta a expiré. Recommencez." }); return; }
  const candidate: any = (transaction.candidates || []).find((page: any) => page.pageId === pageId);
  if (!candidate) { res.status(400).json({ status: "Failed", message: "Page Meta non disponible dans cette autorisation." }); return; }
  if (!candidate.tasks.some((task: string) => ["CREATE_CONTENT", "PROFILE_PLUS_CREATE_CONTENT", "MANAGE", "PROFILE_PLUS_MANAGE", "FULL_CONTROL", "PROFILE_PLUS_FULL_CONTROL"].includes(task))) {
    res.status(403).json({ status: "Failed", message: "Votre accès Meta ne permet pas de publier sur cette Page." }); return;
  }
  await FacebookPageConnection.findOneAndUpdate({ connectionKey: "primary" }, { pageId, pageName: candidate.pageName, encryptedAccessToken: candidate.encryptedAccessToken, connectedBy: actor._id, connectedAt: new Date(), updatedAt: new Date() }, { upsert: true, new: true, setDefaultsOnInsert: true });
  await transaction.deleteOne();
  try { await recordAdminAction({ actorId: String(actor._id), actorName: actor.username || "Super Admin", action: "facebook.page.connected", targetType: "facebook_page", targetId: pageId, targetLabel: candidate.pageName, ip: req.ip }); }
  catch (auditError) { console.error("Facebook connection audit write failed", auditError instanceof Error ? auditError.message : "unknown error"); }
  res.json({ status: "Success", message: `Page ${candidate.pageName} connectée.` });
});

export const facebookDisconnect = expressAsyncHandler(async (req: Request, res: Response) => {
  const actor = await admin(req, res); if (!actor) return;
  const page: any = await FacebookPageConnection.findOne({ connectionKey: "primary" }).select("pageId pageName").lean();
  await FacebookPageConnection.deleteMany({}); await FacebookOAuthTransaction.deleteMany({});
  if (page) {
    try { await recordAdminAction({ actorId: String(actor._id), actorName: actor.username || "Super Admin", action: "facebook.page.disconnected", targetType: "facebook_page", targetId: page.pageId, targetLabel: page.pageName, ip: req.ip }); }
    catch (auditError) { console.error("Facebook disconnection audit write failed", auditError instanceof Error ? auditError.message : "unknown error"); }
  }
  res.json({ status: "Success", message: "Connexion Meta supprimée." });
});

export const facebookProducts = expressAsyncHandler(async (req: Request, res: Response) => {
  if (!await admin(req, res)) return;
  const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit || "20"), 10) || 20));
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const filter: any = { publicationStatus: "Approved" };
  if (q) filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const [products, total, connectionResult] = await Promise.all([
    Product.find(filter).select("name description price photos boutiks_id createdAt").populate("boutiks_id", "name isActive").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter), FacebookPageConnection.findOne({ connectionKey: "primary" }).select("pageId").lean(),
  ]);
  const connection: any = connectionResult;
  const publications = connection ? await FacebookPublication.find({ pageId: connection.pageId, productId: { $in: products.map((product: any) => product._id) } }).sort({ createdAt: -1 }).lean() : [];
  const byProduct = new Map<string, any>();
  publications.forEach((publication: any) => { const id = String(publication.productId); if (!byProduct.has(id)) byProduct.set(id, publication); });
  res.json({ status: "Success", data: products.map((product: any) => ({ ...product, publication: byProduct.get(String(product._id)) || null })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const facebookPublishProduct = expressAsyncHandler(async (req: Request, res: Response) => {
  const actor = await admin(req, res); if (!actor) return;
  if (!Types.ObjectId.isValid(req.params.productId)) { res.status(400).json({ status: "Failed", message: "Identifiant produit invalide." }); return; }
  const product: any = await Product.findOne({ _id: req.params.productId, publicationStatus: "Approved" }).populate("boutiks_id", "name isActive").lean();
  if (!product) { res.status(404).json({ status: "Failed", message: "Seuls les produits approuvés peuvent être publiés." }); return; }
  if (!product.boutiks_id?.isActive) { res.status(409).json({ status: "Failed", message: "La boutique du vendeur est désactivée." }); return; }
  const photo = Array.isArray(product.photos) ? product.photos.find((item: string) => typeof item === "string" && item.trim()) : null;
  const backendUrl = (process.env.BACKEND_PUBLIC_URL || "").replace(/\/$/, "");
  const shopUrl = (process.env.SHOPINMADA_PUBLIC_URL || "").replace(/\/$/, "");
  if (!photo || !backendUrl.startsWith("https://") || !shopUrl.startsWith("https://")) { res.status(503).json({ status: "Failed", message: "Une photo publique et les URLs HTTPS BACKEND_PUBLIC_URL et SHOPINMADA_PUBLIC_URL sont nécessaires." }); return; }
  const filename = path.basename(photo);
  if (!filename || filename === "." || filename === "..") { res.status(400).json({ status: "Failed", message: "Photo produit invalide." }); return; }
  const connection: any = await FacebookPageConnection.findOne({ connectionKey: "primary" }).select("+encryptedAccessToken pageId pageName");
  if (!connection) { res.status(409).json({ status: "Failed", message: "Connectez d’abord une Page Facebook." }); return; }
  const caption = `${String(product.name).slice(0, 180)}\n\n${String(product.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 1500)}\n\nPrix : ${Number(product.price).toLocaleString("fr-FR")} MGA\nBoutique : ${String(product.boutiks_id.name).slice(0, 100)}\n${shopUrl}/product/${product._id}/details`;
  let publication: any;
  try {
    publication = await FacebookPublication.create({ productId: product._id, pageId: connection.pageId, pageName: connection.pageName, status: "publishing", publishedBy: actor._id, caption, attemptCount: 1 });
  } catch (error: any) {
    if (error?.code === 11000) { res.status(409).json({ status: "Failed", message: "Une publication est déjà en cours. Actualisez son statut." }); return; }
    throw error;
  }
  try {
    const body = new URLSearchParams({ url: `${backendUrl}/api/v1/uploads/${encodeURIComponent(filename)}`, caption, published: "true", access_token: decrypt(connection.encryptedAccessToken) });
    const result = await graphJson(`${graphBase()}/${encodeURIComponent(connection.pageId)}/photos`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const postId = String(result.post_id || result.id || "");
    let permalink: string | undefined;
    if (postId) { try { const post = await graphJson(`${graphBase()}/${encodeURIComponent(postId)}?fields=permalink_url&access_token=${encodeURIComponent(decrypt(connection.encryptedAccessToken))}`); permalink = post.permalink_url; } catch { /* publication already succeeded */ } }
    publication.status = "published"; publication.graphPostId = postId; publication.permalink = permalink; publication.publishedAt = new Date(); publication.errorMessage = undefined; await publication.save();
    try { await recordAdminAction({ actorId: String(actor._id), actorName: actor.username || "Super Admin", action: "facebook.product.published", targetType: "product", targetId: String(product._id), targetLabel: product.name, reason: `page:${connection.pageId}`, metadata: { postId }, ip: req.ip }); }
    catch (auditError) { console.error("Facebook publication audit write failed", auditError instanceof Error ? auditError.message : "unknown error"); }
    res.json({ status: "Success", message: "Produit publié sur Facebook.", data: { publication } });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Échec Meta Graph API.";
    publication.status = "failed"; publication.errorMessage = message; await publication.save();
    await recordAdminAction({ actorId: String(actor._id), actorName: actor.username || "Super Admin", action: "facebook.product.publish_failed", targetType: "product", targetId: String(product._id), targetLabel: product.name, reason: message, ip: req.ip });
    res.status(502).json({ status: "Failed", message: `Meta n’a pas accepté la publication : ${message}` });
  }
});
