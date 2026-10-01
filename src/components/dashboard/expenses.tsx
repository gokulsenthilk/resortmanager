import { Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent } from "react";
import type { AccountEntry, Homestay } from "@/lib/types";

import { inr, commonExpenseCategories, type CommonExpenseForm } from "./shared";
import { EmptyState, Field } from "./ui";
import { formatDate, defaultCommonExpenseLabel } from "./utils";

export function DeleteExpenseConfirm({
  expense,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: {
  expense: AccountEntry;
  isDeleting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="min-w-0 pr-10">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-red-50 text-red-700">
          <Trash2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">
            Delete expense
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            This removes the expense from history and updates account totals.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="font-medium text-slate-950">{expense.label}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          <span>{expense.category}</span>
          <span>{formatDate(expense.date)}</span>
          <span className="font-semibold text-red-700">
            -{inr.format(expense.amount)}
          </span>
        </div>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-700">{error}</p>}

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-700 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300"
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? "Deleting expense" : "Delete expense"}
        </button>
      </div>
    </section>
  );
}

export function CommonExpensesPanel({
  form,
  homestays,
  expenses,
  totalExpenses,
  totalCount,
  page,
  pageSize,
  isHistoryLoading,
  historyError,
  isSaving,
  saveError,
  deleteError,
  disabled,
  editingExpenseId,
  deletingExpenseId,
  onChange,
  onSubmit,
  onEdit,
  onCancelEdit,
  onDelete,
  onPageChange,
}: {
  form: CommonExpenseForm;
  homestays: Homestay[];
  expenses: AccountEntry[];
  totalExpenses: number;
  totalCount: number;
  page: number;
  pageSize: number;
  isHistoryLoading: boolean;
  historyError: string;
  isSaving: boolean;
  saveError: string;
  deleteError: string;
  disabled: boolean;
  editingExpenseId: string;
  deletingExpenseId: string;
  onChange: (form: CommonExpenseForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (expense: AccountEntry) => void;
  onCancelEdit: () => void;
  onDelete: (expense: AccountEntry) => void;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const firstItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(totalCount, page * pageSize);
  const canSubmit = Boolean(
    form.homestayId &&
      form.category &&
      form.label &&
      form.entryDate &&
      form.amount > 0 &&
      !isSaving,
  );

  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">
          Common expenses
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Record rent, maid salary, utilities, supplies, and recurring property costs.
        </p>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <Field label="Homestay">
            <select
              value={form.homestayId}
              onChange={(event) =>
                onChange({ ...form, homestayId: event.target.value })
              }
              className="field-control"
              disabled={disabled || homestays.length === 0}
              required
            >
              <option value="">Select homestay</option>
              {homestays.map((homestay) => (
                <option key={homestay.id} value={homestay.id}>
                  {homestay.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(event) =>
                onChange({
                  ...form,
                  category: event.target.value,
                  label: defaultCommonExpenseLabel(event.target.value),
                })
              }
              className="field-control"
              disabled={disabled}
            >
              {commonExpenseCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Label">
            <input
              value={form.label}
              onChange={(event) =>
                onChange({ ...form, label: event.target.value })
              }
              className="field-control"
              required
              disabled={disabled}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date">
              <input
                type="date"
                value={form.entryDate}
                onChange={(event) =>
                  onChange({ ...form, entryDate: event.target.value })
                }
                className="field-control"
                required
                disabled={disabled}
              />
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min="0"
                value={form.amount}
                onChange={(event) =>
                  onChange({ ...form, amount: Number(event.target.value) })
                }
                className="field-control"
                required
                disabled={disabled}
              />
            </Field>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.isCleared}
              onChange={(event) =>
                onChange({ ...form, isCleared: event.target.checked })
              }
              disabled={disabled}
              className="h-4 w-4 rounded border-slate-300 text-teal-700"
            />
            Paid / cleared
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="submit"
              disabled={disabled || !canSubmit}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 ${
                editingExpenseId
                  ? "bg-teal-700 hover:bg-teal-800"
                  : "bg-slate-950 hover:bg-slate-800"
              } ${editingExpenseId ? "" : "sm:col-span-2"}`}
            >
              {editingExpenseId ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isSaving
                ? "Saving expense"
                : editingExpenseId
                  ? "Update expense"
                  : "Add expense"}
            </button>
            {editingExpenseId && (
              <button
                type="button"
                onClick={onCancelEdit}
                disabled={disabled || isSaving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>
          {disabled && (
            <p className="text-sm text-slate-500">
              Sign in before adding common expenses.
            </p>
          )}
          {saveError && (
            <p className="text-sm font-medium text-red-700">{saveError}</p>
          )}
          {deleteError && (
            <p className="text-sm font-medium text-red-700">{deleteError}</p>
          )}
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950">
              Expense history
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              These entries are included in Accounts expense totals.
            </p>
          </div>
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
            {inr.format(totalExpenses)}
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {historyError && (
            <p className="p-4 text-sm font-medium text-red-700">
              {historyError}
            </p>
          )}
          {isHistoryLoading && (
            <p className="p-4 text-sm text-slate-500">
              Loading expense history.
            </p>
          )}
          {!isHistoryLoading && !historyError && expenses.length === 0 && (
            <EmptyState message="No common expenses found for the selected homestay." />
          )}
          {!isHistoryLoading && !historyError && expenses.map((expense) => {
            const homestay = homestays.find(
              (item) => item.id === expense.homestayId,
            );

            return (
              <div
                key={expense.id}
                className={`grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_110px_120px_170px] md:items-center ${
                  editingExpenseId === expense.id ? "bg-teal-50/60" : ""
                }`}
              >
                <div>
                  <p className="font-medium text-slate-950">
                    {expense.label}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {homestay?.name ?? "Homestay"} - {expense.category}
                  </p>
                </div>
                <span className="text-sm text-slate-500">
                  {formatDate(expense.date)}
                </span>
                <span className="text-right text-sm font-semibold text-red-700">
                  -{inr.format(expense.amount)}
                </span>
                <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={() => onEdit(expense)}
                    disabled={disabled || isSaving}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(expense)}
                    disabled={
                      disabled ||
                      isSaving ||
                      deletingExpenseId === expense.id
                    }
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-100 bg-white px-3 text-sm font-semibold text-red-700 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingExpenseId === expense.id ? "Deleting" : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {totalCount === 0
              ? "No expenses"
              : `Showing ${firstItem}-${lastItem} of ${totalCount}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1 || isHistoryLoading}
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Previous
            </button>
            <span className="min-w-20 text-center text-sm font-semibold text-slate-700">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || isHistoryLoading}
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
