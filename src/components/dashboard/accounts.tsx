import type {
  AccountEntry,
  DashboardData,
  Homestay,
  StaffMember,
} from "@/lib/types";

import { inr } from "./shared";
import { EmptyState } from "./ui";
import { formatDate, formatSalaryPaymentBreakdown } from "./utils";

export function AccountsPanel({
  accounts,
  homestays,
  staffMembers,
  salaryPayments,
  totalRevenue,
  totalExpenses,
}: {
  accounts: AccountEntry[];
  homestays: Homestay[];
  staffMembers: StaffMember[];
  salaryPayments: DashboardData["staffSalaryPayments"];
  totalRevenue: number;
  totalExpenses: number;
}) {
  const transactions = [
    ...accounts.map((entry) => {
      const homestay = homestays.find(
        (item) => item.id === entry.homestayId,
      );

      return {
        id: `account-${entry.id}`,
        label: entry.label,
        detail: `${homestay?.name ?? "Unknown homestay"} - ${entry.category}`,
        date: entry.date,
        amount: entry.amount,
        type: entry.type,
      };
    }),
    ...salaryPayments.map((payment) => {
      const staff = staffMembers.find((item) => item.id === payment.staffId);

      return {
        id: `salary-${payment.id}`,
        label: `${staff?.name ?? "Staff member"} salary`,
        detail: formatSalaryPaymentBreakdown(payment),
        date: payment.paidOn,
        amount: payment.amount,
        type: "expense" as const,
      };
    }),
  ].sort((first, second) => second.date.localeCompare(first.date));

  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">
          Accounts module
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Track payouts, pending invoices, and property-level expenses.
        </p>

        <div className="mt-5 space-y-3">
          <AccountSummary
            label="Total revenue"
            value={totalRevenue}
            tone="income"
          />
          <AccountSummary
            label="Expenses"
            value={totalExpenses}
            tone="expense"
          />
          <AccountSummary
            label="Net position"
            value={totalRevenue - totalExpenses}
            tone="net"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-950">
            Recent transactions
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {transactions.length === 0 && (
            <EmptyState message="No transactions matched the current filters." />
          )}
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_150px_140px] md:items-center"
            >
              <div>
                <p className="font-medium text-slate-950">
                  {transaction.label}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {transaction.detail}
                </p>
              </div>
              <span className="text-sm text-slate-500">
                {formatDate(transaction.date)}
              </span>
              <span
                className={`text-right text-sm font-semibold ${transaction.type === "income" ? "text-teal-700" : "text-red-700"}`}
              >
                {transaction.type === "income" ? "+" : "-"}
                {inr.format(transaction.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AccountSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "income" | "expense" | "net";
}) {
  const styles = {
    income: "bg-teal-50 text-teal-800",
    expense: "bg-red-50 text-red-800",
    net: "bg-slate-100 text-slate-950",
  };

  return (
    <div className={`rounded-md p-3 ${styles[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-normal">
        {inr.format(value)}
      </p>
    </div>
  );
}
