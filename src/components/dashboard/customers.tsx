import { ChevronDown, Filter, Pencil, Plus, Search } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { DashboardData } from "@/lib/types";

import { inr, type CustomerForm, type CustomerEditForm } from "./shared";
import { EmptyState, Field, Stat } from "./ui";
import { formatDate } from "./utils";

export function SearchableCustomerSelect({
  customers,
  selectedCustomerId,
  onSelect,
}: {
  customers: DashboardData["customers"];
  selectedCustomerId: string;
  onSelect: (customerId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const [search, setSearch] = useState(selectedCustomer?.name ?? "");

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term || selectedCustomer?.name === search) {
      return customers;
    }

    return customers.filter((customer) => {
      return `${customer.name} ${customer.phone} ${customer.email} ${customer.city}`
        .toLowerCase()
        .includes(term);
    });
  }, [customers, search, selectedCustomer?.name]);

  return (
    <div className="relative min-w-0">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        placeholder={
          customers.length === 0 ? "No customers found" : "Search customer"
        }
        disabled={customers.length === 0}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

      {isOpen && customers.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-40 max-h-64 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {filteredCustomers.length === 0 && (
            <p className="px-3 py-2 text-sm text-slate-500">
              No matching customers.
            </p>
          )}
          {filteredCustomers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(customer.id);
                setSearch(customer.name);
                setIsOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-teal-50 ${
                customer.id === selectedCustomerId
                  ? "bg-teal-50 text-teal-800"
                  : "text-slate-800"
              }`}
            >
              <span className="block font-medium">{customer.name}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {customer.phone ||
                  customer.email ||
                  customer.city ||
                  "No contact details"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuickCustomerModal({
  form,
  isSaving,
  error,
  disabled,
  onChange,
  onSubmit,
  onClose,
}: {
  form: CustomerForm;
  isSaving: boolean;
  error: string;
  disabled: boolean;
  onChange: (form: CustomerForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl">
        <CustomerCreateForm
          form={form}
          isSaving={isSaving}
          error={error}
          disabled={disabled}
          onChange={onChange}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

export function CustomerCreateForm({
  form,
  isSaving,
  error,
  disabled,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: CustomerForm;
  isSaving: boolean;
  error: string;
  disabled: boolean;
  onChange: (form: CustomerForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Add Customer
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Create a guest profile for bookings and stay history.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
        >
          Cancel
        </button>
      </div>

      <form className="mt-5 grid gap-4 lg:grid-cols-3" onSubmit={onSubmit}>
        <Field label="Full name">
          <input
            value={form.fullName}
            onChange={(event) =>
              onChange({ ...form, fullName: event.target.value })
            }
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(event) =>
              onChange({ ...form, phone: event.target.value })
            }
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              onChange({ ...form, email: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
        <Field label="City">
          <input
            value={form.city}
            onChange={(event) =>
              onChange({ ...form, city: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
        <div className="lg:col-span-2">
          <Field label="Preferences">
            <input
              value={form.preferences}
              onChange={(event) =>
                onChange({ ...form, preferences: event.target.value })
              }
              className="field-control"
              disabled={disabled}
            />
          </Field>
        </div>
        <div className="lg:col-span-3">
          <button
            type="submit"
            disabled={disabled || isSaving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus className="h-4 w-4" />
            {isSaving ? "Adding customer" : "Add Customer"}
          </button>
          {disabled && (
            <p className="mt-2 text-sm text-slate-500">
              Sign in to Supabase before adding customers.
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm font-medium text-red-700">{error}</p>
          )}
        </div>
      </form>
    </section>
  );
}

export function CustomerEditFormPanel({
  form,
  isSaving,
  error,
  disabled,
  onChange,
  onSubmit,
}: {
  form: CustomerEditForm;
  isSaving: boolean;
  error: string;
  disabled: boolean;
  onChange: (form: CustomerEditForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const canSubmit = Boolean(
    form.customerId && form.fullName && form.phone && !isSaving,
  );

  return (
    <section className="min-w-0 bg-white">
      <h2 className="text-base font-semibold text-slate-950">Edit Customer</h2>
      <p className="mt-1 text-sm text-slate-500">
        Update contact details and guest preferences.
      </p>

      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Full name">
          <input
            value={form.fullName}
            onChange={(event) =>
              onChange({ ...form, fullName: event.target.value })
            }
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(event) =>
              onChange({ ...form, phone: event.target.value })
            }
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              onChange({ ...form, email: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
        <Field label="City">
          <input
            value={form.city}
            onChange={(event) =>
              onChange({ ...form, city: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Preferences">
            <input
              value={form.preferences}
              onChange={(event) =>
                onChange({ ...form, preferences: event.target.value })
              }
              className="field-control"
              disabled={disabled}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={disabled || !canSubmit}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Pencil className="h-4 w-4" />
            {isSaving ? "Saving changes" : "Update Customer"}
          </button>
          {disabled && (
            <p className="mt-2 text-sm text-slate-500">
              Sign in to Supabase before editing customers.
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm font-medium text-red-700">{error}</p>
          )}
        </div>
      </form>
    </section>
  );
}

export function CustomerTable({
  query,
  customers,
  onEditCustomer,
}: {
  query: string;
  customers: DashboardData["customers"];
  onEditCustomer: (customer: DashboardData["customers"][number]) => void;
}) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const cityOptions = useMemo(() => {
    return Array.from(
      new Set(
        customers
          .map((customer) => customer.city.trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b)),
      ),
    );
  }, [customers]);
  const visibleCustomers = useMemo(() => {
    const globalTerm = query.trim().toLowerCase();
    const localTerm = customerSearch.trim().toLowerCase();

    return customers
      .filter((customer) => {
        const haystack =
          `${customer.name} ${customer.phone} ${customer.email} ${customer.city} ${customer.preference}`.toLowerCase();
        const matchesGlobal = !globalTerm || haystack.includes(globalTerm);
        const matchesLocal = !localTerm || haystack.includes(localTerm);
        const matchesCity =
          cityFilter === "all" || customer.city === cityFilter;

        return matchesGlobal && matchesLocal && matchesCity;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cityFilter, customerSearch, customers, query]);
  const totalPages = Math.max(1, Math.ceil(visibleCustomers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedCustomers = visibleCustomers.slice(
    pageStart,
    pageStart + pageSize,
  );

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Customers
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Full guest list with contact details, stay history, and preferences.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,260px)_180px]">
          <label className="relative min-w-0">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Filter customers
            </span>
            <Search className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-slate-400" />
            <input
              value={customerSearch}
              onChange={(event) => {
                setCustomerSearch(event.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="Name, phone, email"
            />
          </label>
          <Field label="City">
            <select
              value={cityFilter}
              onChange={(event) => {
                setCityFilter(event.target.value);
                setPage(1);
              }}
              className="field-control"
            >
              <option value="all">All cities</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {visibleCustomers.length === 0 ? 0 : pageStart + 1}-
          {Math.min(pageStart + pageSize, visibleCustomers.length)} of{" "}
          {visibleCustomers.length} customers
        </p>
        {(customerSearch || cityFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setCustomerSearch("");
              setCityFilter("all");
              setPage(1);
            }}
            className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            <Filter className="h-4 w-4" />
            Clear filters
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {visibleCustomers.length === 0 && (
          <EmptyState message="No customers matched the current search." />
        )}
        {paginatedCustomers.map((customer) => (
          <article key={customer.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-950">
                  {customer.name}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {customer.phone || "No phone"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEditCustomer(customer)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-700 transition hover:border-slate-300"
                aria-label={`Edit ${customer.name}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-2 text-sm text-slate-500">
              <p>{customer.email || "No email"}</p>
              <p>{customer.city || "No city"}</p>
              <p>{customer.preference || "No preferences recorded"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Stays" value={String(customer.stays)} />
              <Stat
                label="Lifetime value"
                value={inr.format(customer.lifetimeValue)}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">City</th>
              <th className="px-4 py-3 font-semibold">Preferences</th>
              <th className="px-4 py-3 text-right font-semibold">Stays</th>
              <th className="px-4 py-3 text-right font-semibold">Lifetime</th>
              <th className="px-4 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleCustomers.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState message="No customers matched the current filters." />
                </td>
              </tr>
            )}
            {paginatedCustomers.map((customer) => (
              <tr key={customer.id} className="hover:bg-slate-50">
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-950">
                    {customer.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Last stay: {formatDate(customer.lastStay)}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium text-slate-900">
                    {customer.phone || "No phone"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {customer.email || "No email"}
                  </p>
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {customer.city || "Unassigned"}
                </td>
                <td className="max-w-xs px-4 py-4">
                  <p className="truncate text-slate-600">
                    {customer.preference || "No preferences recorded"}
                  </p>
                </td>
                <td className="px-4 py-4 text-right font-semibold text-slate-950">
                  {customer.stays}
                </td>
                <td className="px-4 py-4 text-right font-semibold text-slate-950">
                  {inr.format(customer.lifetimeValue)}
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onEditCustomer(customer)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Page {currentPage} of {totalPages}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage === 1}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={currentPage === totalPages}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
