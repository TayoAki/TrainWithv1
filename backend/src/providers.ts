import Stripe from "stripe";
import Mux from "@mux/mux-node";
import type { Config } from "./config.js";
import { ApiError, requireFeature } from "./errors.js";
import type { Row } from "./db.js";

export const record = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
export const array = (v: unknown): Row[] =>
  Array.isArray(v) ? v.map(record) : [];
export const externalId = (v: unknown): string =>
  typeof v === "string" ? v : String(record(v).id || "");
export type ProviderEvent = {
  id: string;
  type: string;
  data: Row;
  account?: string;
};
export type CheckoutInput = {
  creatorId: string;
  name: string;
  price: number;
  currency: string;
  account: string;
  customer: string;
  userId: string;
  key: string;
  expires: number;
  fee: number;
  appUrl: string;
};
export interface Providers {
  verifyStripe(raw: string, signature: string): ProviderEvent;
  verifyMux(
    raw: string,
    headers: Record<string, string>,
  ): Promise<ProviderEvent>;
  customer(userId: string, email: string): Promise<string>;
  checkout(
    input: CheckoutInput,
  ): Promise<{ id: string; url: string; expires: number }>;
  portal(customer: string): Promise<string>;
  connect(
    creatorId: string,
    email: string,
    account?: string,
  ): Promise<{ account: string; url: string }>;
  account(id: string): Promise<Row>;
  subscription(id: string): Promise<Row>;
  invoice(id: string): Promise<Row>;
  charge(id: string): Promise<Row>;
  dispute(id: string): Promise<Row>;
  payout(id: string, account: string): Promise<Row>;
  renewal(id: string, renews: boolean): Promise<void>;
  invoicePayment(invoiceId: string): Promise<Row>;
  upload(
    workoutId: string,
    origin: string,
  ): Promise<{ id: string; url: string }>;
  asset(id: string): Promise<Row>;
  playback(id: string, seconds: number): Promise<string>;
}
export function createProviders(c: Config): Providers {
  const stripe = c.STRIPE_SECRET_KEY
    ? new Stripe(c.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 15000 })
    : undefined;
  const mux =
    c.MUX_TOKEN_ID && c.MUX_TOKEN_SECRET
      ? new Mux({
          tokenId: c.MUX_TOKEN_ID,
          tokenSecret: c.MUX_TOKEN_SECRET,
          jwtSigningKey: c.MUX_SIGNING_KEY_ID,
          jwtPrivateKey: c.MUX_SIGNING_PRIVATE_KEY,
          timeout: 20000,
          maxRetries: 2,
        })
      : undefined;
  const s = () => {
    requireFeature(stripe, "Stripe sandbox");
    return stripe!;
  };
  const m = () => {
    requireFeature(mux, "Mux Video API");
    return mux!;
  };
  return {
    verifyStripe(raw, signature) {
      const secrets = [
        c.STRIPE_WEBHOOK_SECRET,
        c.STRIPE_CONNECT_WEBHOOK_SECRET,
      ].filter(Boolean) as string[];
      requireFeature(secrets.length, "Stripe webhooks");
      for (const secret of secrets) {
        try {
          const e = s().webhooks.constructEvent(raw, signature, secret);
          if (e.livemode) throw new Error("Live event rejected");
          return {
            id: e.id,
            type: e.type,
            data: record(e.data.object),
            account: e.account,
          };
        } catch {
          /* Try the configured Connect destination secret. */
        }
      }
      throw new ApiError(
        400,
        "INVALID_SIGNATURE",
        "Invalid webhook signature.",
      );
    },
    async verifyMux(raw, headers) {
      requireFeature(c.MUX_WEBHOOK_SECRET, "Mux webhooks");
      try {
        const e = record(
          await m().webhooks.unwrap(raw, headers, c.MUX_WEBHOOK_SECRET),
        );
        return { id: String(e.id), type: String(e.type), data: record(e.data) };
      } catch {
        throw new ApiError(
          400,
          "INVALID_SIGNATURE",
          "Invalid webhook signature.",
        );
      }
    },
    async customer(userId, email) {
      return (
        await s().customers.create(
          { email, metadata: { trainwith_user_id: userId } },
          { idempotencyKey: `customer:${userId}` },
        )
      ).id;
    },
    async checkout(i) {
      const session = await s().checkout.sessions.create(
        {
          mode: "subscription",
          customer: i.customer,
          client_reference_id: i.userId,
          success_url: `${i.appUrl}/screen/joined?id=${encodeURIComponent(i.creatorId)}`,
          cancel_url: `${i.appUrl}/screen/membership?id=${encodeURIComponent(i.creatorId)}`,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: i.currency,
                unit_amount: i.price,
                recurring: { interval: "month" },
                product_data: {
                  name: `${i.name} membership`,
                  metadata: { trainwith_creator_id: i.creatorId },
                },
              },
            },
          ],
          subscription_data: {
            application_fee_percent: i.fee,
            transfer_data: { destination: i.account },
            metadata: {
              trainwith_user_id: i.userId,
              trainwith_creator_id: i.creatorId,
            },
          },
          metadata: {
            trainwith_user_id: i.userId,
            trainwith_creator_id: i.creatorId,
          },
          expires_at: i.expires,
        },
        { idempotencyKey: i.key },
      );
      if (!session.url) throw new Error("Stripe did not return Checkout URL");
      return { id: session.id, url: session.url, expires: session.expires_at };
    },
    async portal(customer) {
      return (
        await s().billingPortal.sessions.create({
          customer,
          return_url: `${c.APP_URL}/screen/memberships`,
        })
      ).url;
    },
    async connect(creatorId, email, account) {
      const id =
        account ||
        (
          await s().accounts.create(
            {
              type: "express",
              country: c.CONNECT_COUNTRY,
              email,
              capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
              },
              metadata: { trainwith_creator_id: creatorId },
            },
            { idempotencyKey: `connect:${creatorId}` },
          )
        ).id;
      const link = await s().accountLinks.create({
        account: id,
        type: "account_onboarding",
        refresh_url: `${c.APP_URL}/screen/creator-payout`,
        return_url: `${c.APP_URL}/screen/creator-payout`,
      });
      return { account: id, url: link.url };
    },
    async account(id) {
      return record(await s().accounts.retrieve(id));
    },
    async subscription(id) {
      return record(
        await s().subscriptions.retrieve(id, { expand: ["latest_invoice"] }),
      );
    },
    async invoice(id) {
      return record(await s().invoices.retrieve(id));
    },
    async charge(id) {
      const charge = record(await s().charges.retrieve(id));
      const refunds: Row[] = [];
      for await (const refund of s().refunds.list({ charge: id, limit: 100 }))
        refunds.push(record(refund));
      return { ...charge, refunds: { data: refunds } };
    },
    async dispute(id) {
      return record(await s().disputes.retrieve(id));
    },
    async payout(id, account) {
      return record(
        await s().payouts.retrieve(id, {}, { stripeAccount: account }),
      );
    },
    async renewal(id, renews) {
      await s().subscriptions.update(id, { cancel_at_period_end: !renews });
    },
    async invoicePayment(invoiceId) {
      const payments = await s().invoicePayments.list({
        invoice: invoiceId,
        limit: 10,
      });
      const payment = payments.data.find((p) => p.status === "paid");
      const intentId = externalId(payment?.payment.payment_intent);
      if (!intentId) return {};
      const intent = await s().paymentIntents.retrieve(intentId);
      const chargeId = externalId(intent.latest_charge);
      if (!chargeId) return {};
      return record(
        await s().charges.retrieve(chargeId, {
          expand: ["balance_transaction"],
        }),
      );
    },
    async upload(workoutId, origin) {
      const result = await m().video.uploads.create({
        cors_origin: origin,
        timeout: 3600,
        new_asset_settings: {
          playback_policy: ["signed"],
          video_quality: "basic",
          passthrough: workoutId,
        },
      });
      if (!result.url) throw new Error("Mux did not return an upload URL");
      return { id: result.id, url: result.url };
    },
    async asset(id) {
      return record(await m().video.assets.retrieve(id));
    },
    async playback(id, seconds) {
      requireFeature(
        c.MUX_SIGNING_KEY_ID && c.MUX_SIGNING_PRIVATE_KEY,
        "Mux playback signing",
      );
      const token = await m().jwt.signPlaybackId(id, {
        type: "video",
        expiration: `${Math.ceil(seconds)}s`,
      });
      return `https://stream.mux.com/${encodeURIComponent(id)}.m3u8?token=${encodeURIComponent(token)}`;
    },
  };
}
