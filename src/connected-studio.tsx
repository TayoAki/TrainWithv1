import React, { useCallback, useEffect, useState } from "react";
import { useStore } from "./store";
import { api } from "./backend";
import { Shell, Heading, Card, T, Notice, Button } from "./ui";
type Report = {
  sandbox: boolean;
  members: {
    id: string;
    name: string;
    price_cents: number;
    paid_until: string;
  }[];
  ledger: {
    id: string;
    kind: string;
    amount_cents: number;
    currency: string;
    created_at: string;
  }[];
  payouts: {
    id: string;
    amount_cents: number;
    currency: string;
    status: string;
  }[];
  totals: { gross_collected_cents: string; net_collected_cents: string };
};
export function ConnectedStudioReport({
  kind,
}: {
  kind: "members" | "earnings";
}) {
  const { state } = useStore();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setReport(await api<Report>(`/v1/studio/${state.ownedId}`));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load studio data.");
    }
  }, [state.ownedId]);
  useEffect(() => {
    let active = true;
    api<Report>(`/v1/studio/${state.ownedId}`)
      .then((value) => {
        if (active) {
          setReport(value);
          setError("");
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Could not load studio data.",
          );
      });
    return () => {
      active = false;
    };
  }, [state.ownedId]);
  return (
    <Shell creator>
      <Heading
        title={
          kind === "members"
            ? "People showing up with you."
            : "Your work, adding up."
        }
        description="Recorded by the TrainWith backend."
      />
      <Notice>
        Stripe sandbox activity. These figures do not represent real money.
      </Notice>
      {!!error && <Notice error>{error}</Notice>}
      {!report ? (
        <T>Loading…</T>
      ) : kind === "members" ? (
        <>
          <T>{report.members.length} active members</T>
          {report.members.map((m) => (
            <Card key={m.id}>
              <T bold>{m.name}</T>
              <T>${(m.price_cents / 100).toFixed(2)} / month</T>
              <T>
                Access through {new Date(m.paid_until).toLocaleDateString()}
              </T>
            </Card>
          ))}
        </>
      ) : (
        <>
          <Card>
            <T>Recorded gross payments</T>
            <T bold size={36}>
              ${(Number(report.totals.gross_collected_cents) / 100).toFixed(2)}
            </T>
            <T>
              After recorded refunds and dispute reserves: $
              {(Number(report.totals.net_collected_cents) / 100).toFixed(2)}
            </T>
          </Card>
          <T>
            Payout availability is managed by Stripe. Payment totals are not
            your available balance.
          </T>
          {report.ledger.map((l) => (
            <Card key={l.id}>
              <T bold>
                {l.kind} · {(l.amount_cents / 100).toFixed(2)}{" "}
                {l.currency.toUpperCase()}
              </T>
              <T>{new Date(l.created_at).toLocaleDateString()}</T>
            </Card>
          ))}
          <T bold>Payouts</T>
          {report.payouts.length ? (
            report.payouts.map((p) => (
              <Card key={p.id}>
                <T>
                  {(p.amount_cents / 100).toFixed(2)} {p.currency.toUpperCase()}{" "}
                  · {p.status}
                </T>
              </Card>
            ))
          ) : (
            <T>No payouts recorded.</T>
          )}
        </>
      )}
      <Button secondary title="Refresh studio" onPress={() => void load()} />
    </Shell>
  );
}
