import React, { useEffect, useState } from "react";
import { Linking } from "react-native";
import { useRouter } from "expo-router";
import { api } from "./backend";
import type { PublicConfig } from "./purchase-policy";
import { Button, Card, Field, Heading, Notice, Shell, T, go } from "./ui";

function usePublicConfig() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  useEffect(() => {
    let active = true;
    void api<PublicConfig>("/public/config")
      .then((c) => {
        if (active) setConfig(c);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return config;
}
export function Privacy() {
  const config = usePublicConfig();
  const router = useRouter();
  return (
    <Shell back title="Privacy policy">
      <Heading
        title="Your privacy at TrainWith"
        description="Effective 19 September 2026 · Beta service"
      />
      <T>
        {config?.operatorName || "TrainWith"} operates this service. Use Contact
        TrainWith for privacy questions, access/export requests or complaints.
        {config?.supportEmail
          ? ` You can also email ${config.supportEmail}.`
          : ""}
      </T>
      <Card>
        <T bold>Information we use</T>
        <T>
          We use your email, profile name and authentication records to run your
          account. We store memberships, saved programs, completed workouts and
          support requests to provide your training experience. For creators, we
          store your public profile, uploaded videos, program information,
          prices and payment-account identifiers. Your profile and published
          creator content are visible to other people.
        </T>
        <T>
          We record adult eligibility, its source, the policy version you
          accepted and the acceptance time. We do not request your full birth
          date or identity documents in TrainWith. On supported iPhones, Apple
          can share an age range. A declared age is not identity verification.
        </T>
      </Card>
      <Card>
        <T bold>Service providers</T>
        <T>
          Supabase hosts authentication and the database. Railway hosts the
          application and API. Mux processes and delivers video. Stripe
          processes payments and creator onboarding. These services receive the
          information needed to perform those functions, including
          network/device information. Card details and creator verification
          documents are entered with Stripe; TrainWith does not store card
          numbers or bank passwords. External profile images may contact their
          hosting provider.
        </T>
        <T>
          TrainWith does not currently sell personal information, run targeted
          advertising, or use data for cross-app advertising tracking. Resend
          and Sentry are not enabled. Necessary security and service logs help
          diagnose failures and prevent abuse.
        </T>
      </Card>
      <Card>
        <T bold>Safety and billing</T>
        <T>
          Reports, blocks and moderation records help protect members. Reporters
          are not identified to creators. Authorized operators can review
          reports and support requests. Creators can see member names and
          limited membership information for their channel. Stripe and relevant
          financial institutions handle payment and payout records under their
          own obligations.
        </T>
      </Card>
      <Card>
        <T bold>Retention and deletion</T>
        <T>
          We keep account and training information while your account is active.
          Delete account in Settings initiates removal of your profile,
          progress, saved programs and creator content, cancels affected
          subscriptions and deletes your authentication account. Processing is
          normally completed in minutes; provider failures are retried and shown
          on your private deletion receipt. Contact us if it is still pending
          after 7 days.
        </T>
        <T>
          Limited transaction records and non-content identifiers may remain for
          accounting, disputes, security and handling delayed provider events.
          Payment providers retain records under their own requirements. Backup
          copies follow the configured hosting-provider retention schedule; they
          are not used to restore a deleted account into service. We review
          retained records and delete them when no longer needed.
        </T>
      </Card>
      <Card>
        <T bold>Your choices and age limits</T>
        <T>
          The initial beta is for adults aged 18 and over. We block workout
          access until you confirm eligibility and accept the terms. You can
          request access, correction or export through Contact TrainWith, manage
          subscription renewal in My memberships, block creators in their
          channels, and initiate deletion in Settings. Requests are assessed
          under the laws that apply to you. Data may be processed outside your
          country by our providers.
        </T>
      </Card>
      <Button title="Contact TrainWith" onPress={() => go(router, "contact")} />
      <Button
        secondary
        title="Delete account"
        onPress={() => go(router, "delete-account")}
      />
      <Button
        subtle
        title="Terms & community rules"
        onPress={() => go(router, "terms")}
      />
    </Shell>
  );
}
export function Terms() {
  const router = useRouter();
  return (
    <Shell back title="Terms & community rules">
      <Heading
        title="TrainWith beta terms"
        description="Effective 19 September 2026"
      />
      <Card>
        <T bold>Who can use TrainWith</T>
        <T>
          This beta is for adults 18 and over. Provide accurate eligibility and
          account information, protect your password, and use only accounts and
          content you are authorized to access. The first planned iOS storefront
          is the United States; availability elsewhere is not promised.
        </T>
      </Card>
      <Card>
        <T bold>Memberships</T>
        <T>
          The app is intended to be free to download. A creator membership
          unlocks that creator’s published workouts and programs. Prices and
          monthly renewal terms are shown before checkout. Stripe processes web
          purchases and eligible US iOS browser purchases. During this beta,
          checkout is sandbox-only and no real money is charged or paid out. You
          can cancel renewal in My memberships. Blocking a creator does not
          cancel renewal. Account deletion cancels affected subscriptions; it
          does not automatically refund past payments. Contact TrainWith for
          billing issues or refund requests; applicable consumer rights are not
          excluded.
        </T>
      </Card>
      <Card>
        <T bold>Creator content and moderation</T>
        <T>
          Upload only videos, music, images and other material you own or have
          permission to distribute. By publishing you permit TrainWith and its
          hosting providers to store, process and display that content to
          deliver the service. Do not upload sexual or age-inappropriate
          material, harassment, hate, threats, dangerous training instructions,
          unlawful content or misleading health claims. No impersonation, spam
          or attempts to bypass access controls.
        </T>
        <T>
          Creator profiles, workouts and programs require content review before
          publication. Use Report on a workout or channel to flag safety, age,
          rights or abuse concerns. You can block creators. TrainWith may remove
          content or restrict channels/accounts for violations. Contact us to
          ask for review of a moderation decision. Operators review reports;
          this is not an emergency service.
        </T>
      </Card>
      <Card>
        <T bold>Train within your limits</T>
        <T>
          Workouts provide general fitness instruction, not a medical diagnosis
          or personalized medical care. Choose a suitable level, follow
          equipment guidance and stop if you feel pain or unwell. Seek qualified
          medical advice when appropriate. Creators must describe exercises
          accurately and avoid unsupported treatment claims.
        </T>
      </Card>
      <Card>
        <T bold>Beta limitations and changes</T>
        <T>
          Features may change or be temporarily unavailable. Creators upload
          through the web studio. New purchases are offered only through
          supported flows. We will show material changes to these terms before
          requesting renewed acceptance. These terms do not remove rights that
          cannot be waived under applicable law.
        </T>
      </Card>
      <Button title="Contact TrainWith" onPress={() => go(router, "contact")} />
      <Button
        subtle
        title="Privacy policy"
        onPress={() => go(router, "privacy")}
      />
    </Shell>
  );
}
export function Contact() {
  const config = usePublicConfig();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  return (
    <Shell back title="Contact TrainWith">
      <Heading
        title="How can we help?"
        description="Privacy, billing, content concerns and account support."
      />
      {config?.supportEmail && (
        <Button
          secondary
          title={`Email ${config.supportEmail}`}
          onPress={() => void Linking.openURL(`mailto:${config.supportEmail}`)}
        />
      )}
      <T>
        Do not include passwords, payment card numbers or sensitive medical
        information. This form reaches the operator inbox. A reply can be sent
        to the email you provide; automated email replies are not enabled.
      </T>
      {result ? (
        <Notice>{result}</Notice>
      ) : (
        <>
          <Field
            label="Your contact email"
            value={email}
            onChange={setEmail}
            keyboardType="email-address"
          />
          <Field
            label="How can we help?"
            value={message}
            onChange={setMessage}
            multiline
          />
          {!!error && <Notice error>{error}</Notice>}
          <Button
            title="Send to TrainWith support"
            disabled={!email.includes("@") || message.trim().length < 10}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                const r = await api<{ id: string }>("/public/contact", {
                  email,
                  message,
                  website: "",
                });
                setResult(`Your request has been received. Reference: ${r.id}`);
                setMessage("");
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not submit your request.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </Shell>
  );
}
