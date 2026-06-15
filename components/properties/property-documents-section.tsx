"use client";

import {
  deletePropertyDocumentAction,
  updatePropertyDocumentMetadataAction,
  uploadPropertyDocumentAction,
} from "@/app/(dashboard)/properties/document-actions";
import {
  FormField,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import {
  PROPERTY_DOCUMENT_TYPE_LABELS,
  type PropertyDocumentScope,
  type StaffPropertyDocumentType,
} from "@/lib/property/document-types";
import { titleFromUploadFileName } from "@/lib/property/property-document-upload";
import type { PropertyDocumentListItem, PropertyDocumentsPageData } from "@/lib/property/property-documents-staff";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";

function formatUploadedDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatFileSize(sizeBytes: number | null): string | null {
  if (sizeBytes == null) return null;
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function categoriesForScope(
  scope: PropertyDocumentScope,
  data: PropertyDocumentsPageData,
): StaffPropertyDocumentType[] {
  return scope === "property" ? data.propertyCategories : data.tenancyCategories;
}

function UploadPropertyDocumentForm({
  propertyId,
  data,
  canEdit,
}: {
  propertyId: string;
  data: PropertyDocumentsPageData;
  canEdit: boolean;
}) {
  const router = useRouter();
  const fileId = useId();
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [scope, setScope] = useState<PropertyDocumentScope>(data.defaultScope);
  const [documentType, setDocumentType] = useState<StaffPropertyDocumentType>(
    categoriesForScope(data.defaultScope, data)[0] ?? "property_misc",
  );
  const [title, setTitle] = useState("");

  const categoryOptions = useMemo(() => categoriesForScope(scope, data), [scope, data]);

  if (!canEdit) {
    return (
      <InlineNotice>
        Property manager or organization admin access is required to upload documents.
      </InlineNotice>
    );
  }

  function onScopeChange(nextScope: PropertyDocumentScope) {
    setScope(nextScope);
    const nextCategories = categoriesForScope(nextScope, data);
    setDocumentType(nextCategories[0] ?? "property_misc");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("scope", scope);
    formData.set("documentType", documentType);
    formData.set("title", title.trim());

    startTransition(async () => {
      const result = await uploadPropertyDocumentAction(propertyId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.reset();
      setTitle("");
      setScope(data.defaultScope);
      setDocumentType(categoriesForScope(data.defaultScope, data)[0] ?? "property_misc");
      setShowForm(false);
      router.refresh();
    });
  }

  return (
    <div>
      {showForm ? (
        <form className={`${SURFACE_PANEL} flex flex-col gap-4 px-4 py-4`} onSubmit={onSubmit}>
          {error ? <InlineNotice>{error}</InlineNotice> : null}

          <FormField
            label="File"
            htmlFor={fileId}
            helper="PDF, JPG, PNG, or WebP up to 25 MB"
          >
            <input
              id={fileId}
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              required
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && !title.trim()) {
                  setTitle(titleFromUploadFileName(file.name));
                }
              }}
              className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border file:border-neutral-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium"
            />
          </FormField>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-neutral-900">Scope</legend>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="radio"
                name="scopeChoice"
                checked={scope === "property"}
                onChange={() => onScopeChange("property")}
              />
              Property
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="radio"
                name="scopeChoice"
                checked={scope === "tenancy"}
                disabled={!data.hasActiveTenancy}
                onChange={() => onScopeChange("tenancy")}
              />
              Active tenancy
            </label>
            {!data.hasActiveTenancy ? (
              <p className="text-sm text-neutral-600">No active tenancy — property scope only.</p>
            ) : null}
          </fieldset>

          <FormField label="Category" htmlFor={`${titleId}-category`}>
            <select
              id={`${titleId}-category`}
              value={documentType}
              onChange={(event) =>
                setDocumentType(event.target.value as StaffPropertyDocumentType)
              }
              className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            >
              {categoryOptions.map((value) => (
                <option key={value} value={value}>
                  {PROPERTY_DOCUMENT_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Title" htmlFor={titleId}>
            <input
              id={titleId}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
              placeholder="Document title"
              required
            />
          </FormField>

          <div className="flex flex-wrap gap-3">
            <PrimaryButton type="submit" disabled={pending}>
              {pending ? "Uploading…" : "Upload document"}
            </PrimaryButton>
            <button
              type="button"
              className="text-sm font-medium text-neutral-700 underline"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-sm font-medium text-neutral-800 underline"
        >
          + Upload document
        </button>
      )}
    </div>
  );
}

function DocumentRowEditor({
  propertyId,
  document,
  activeTenancyId,
  categoryOptions,
}: {
  propertyId: string;
  document: PropertyDocumentListItem;
  activeTenancyId: string | null;
  categoryOptions: StaffPropertyDocumentType[];
}) {
  const router = useRouter();
  const titleId = useId();
  const categoryId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(document.title);
  const [documentType, setDocumentType] = useState(document.documentType);

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("title", title.trim());
    formData.set("documentType", documentType);

    startTransition(async () => {
      const result = await updatePropertyDocumentMetadataAction(
        propertyId,
        document.id,
        formData,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function onDelete() {
    if (!window.confirm(`Delete "${document.title}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deletePropertyDocumentAction(propertyId, document.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (editing) {
    return (
      <form className="mt-3 flex flex-col gap-3 border-t border-neutral-200 pt-3" onSubmit={onSave}>
        {error ? <InlineNotice>{error}</InlineNotice> : null}
        <FormField label="Title" htmlFor={titleId}>
          <input
            id={titleId}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            required
          />
        </FormField>
        {!document.isSystemManaged ? (
          <FormField label="Category" htmlFor={categoryId}>
            <select
              id={categoryId}
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            >
              {categoryOptions.map((value) => (
                <option key={value} value={value}>
                  {PROPERTY_DOCUMENT_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </PrimaryButton>
          <button
            type="button"
            className="text-sm font-medium text-neutral-700 underline"
            onClick={() => {
              setEditing(false);
              setTitle(document.title);
              setDocumentType(document.documentType);
              setError(null);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-3">
      <a
        href={document.downloadHref}
        className="text-sm font-medium text-neutral-800 underline"
        target="_blank"
        rel="noreferrer"
      >
        Download
      </a>
      {document.canEdit && !document.isSystemManaged ? (
        <>
          <button
            type="button"
            className="text-sm font-medium text-neutral-700 underline"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button
            type="button"
            className="text-sm font-medium text-red-700 underline"
            onClick={onDelete}
            disabled={pending}
          >
            Delete
          </button>
        </>
      ) : null}
      {document.isSystemManaged && activeTenancyId ? (
        <Link
          href={`/leasing/tenancies/${activeTenancyId}`}
          className="text-sm font-medium text-neutral-700 underline"
        >
          Manage lease signing
        </Link>
      ) : null}
      {error ? <InlineNotice className="w-full">{error}</InlineNotice> : null}
    </div>
  );
}

function PropertyDocumentRow({
  propertyId,
  document,
  data,
}: {
  propertyId: string;
  document: PropertyDocumentListItem;
  data: PropertyDocumentsPageData;
}) {
  const categoryOptions = categoriesForScope(document.scope, data);
  const sizeLabel = formatFileSize(document.sizeBytes);
  const statusParts = [
    document.isLocked ? "Locked" : null,
    document.isSigned ? "Signed" : null,
    document.isSystemManaged ? "System" : null,
  ].filter(Boolean);

  return (
    <li className={`${SURFACE_PANEL} px-3.5 py-3`}>
      <div className="flex flex-col gap-1">
        <div className="font-medium text-neutral-900">{document.title}</div>
        <div className="text-sm text-neutral-600">
          {document.categoryLabel} · {document.scopeLabel}
        </div>
        <div className="text-sm text-neutral-600">
          {document.fileName}
          {sizeLabel ? ` · ${sizeLabel}` : ""} · Uploaded {formatUploadedDate(document.createdAt)}
        </div>
        {statusParts.length > 0 ? (
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {statusParts.join(" · ")}
          </div>
        ) : null}
      </div>
      <DocumentRowEditor
        propertyId={propertyId}
        document={document}
        activeTenancyId={data.activeTenancyId}
        categoryOptions={categoryOptions}
      />
    </li>
  );
}

export function PropertyDocumentsSection({
  propertyId,
  data,
  canEdit,
  loadError,
}: {
  propertyId: string;
  data: PropertyDocumentsPageData | null;
  canEdit: boolean;
  loadError: string | null;
}) {
  return (
    <div className={`${SURFACE_CARD} mb-8 px-4 py-4`} id="documents">
      <p className="text-sm font-semibold text-neutral-900">Documents</p>
      <p className="mt-1 text-sm text-neutral-600">
        Upload property and tenancy files for this record.
      </p>

      {loadError ? <InlineNotice className="mt-4">{loadError}</InlineNotice> : null}
      {data ? (
        <>
          <div className="mt-4">
            <UploadPropertyDocumentForm propertyId={propertyId} data={data} canEdit={canEdit} />
          </div>
          {data.documents.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-600">No documents uploaded yet.</p>
          ) : (
            <ul className="mt-4 flex list-none flex-col gap-3 p-0">
              {data.documents.map((document) => (
                <PropertyDocumentRow
                  key={document.id}
                  propertyId={propertyId}
                  document={document}
                  data={data}
                />
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
