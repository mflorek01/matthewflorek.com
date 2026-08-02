"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type LinkItem = { id: string; label: string; url: string; sortOrder: number };
type Project = {
  id: string;
  slug: string;
  categoryId: string;
  title: string;
  summary: string;
  details: unknown;
  publicationStatus: string;
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
  sortOrder: number;
  includeInAi: boolean;
  source: string | null;
  reviewNotes: string | null;
  links: LinkItem[];
  revisions: Array<{
    id: string;
    version: number;
    status: string;
    createdAt: Date | string;
  }>;
};
type Category = { id: string; name: string };
type Asset = {
  id: string;
  kind: string;
  altText: string | null;
  visibility: string;
  createdAt: string;
};
type ProjectDetails = {
  tags?: string[];
  context?: string;
  contribution?: string;
  outcome?: string;
  [key: string]: unknown;
};
function clientId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function SortableLink({
  item,
  onChange,
  onRemove,
}: {
  item: LinkItem;
  onChange: (patch: Partial<LinkItem>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="admin-link-row"
    >
      <button
        type="button"
        className="drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${item.label}`}
      >
        ↕
      </button>
      <input
        value={item.label}
        onChange={(e) => onChange({ label: e.target.value })}
        aria-label="Link label"
      />
      <input
        value={item.url}
        onChange={(e) => onChange({ url: e.target.value })}
        aria-label="Link URL"
      />
      <button
        type="button"
        className="admin-button admin-button-danger"
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  );
}

export function ProjectEditor({
  project,
  categories,
}: {
  project: Project;
  categories: Category[];
}) {
  const initial = (
    project.details &&
    typeof project.details === "object" &&
    !Array.isArray(project.details)
      ? project.details
      : {}
  ) as ProjectDetails;
  const [draft, setDraft] = useState({
    slug: project.slug,
    categoryId: project.categoryId,
    title: project.title,
    summary: project.summary,
    details: JSON.stringify(project.details ?? {}, null, 2),
    tags: Array.isArray(initial.tags) ? initial.tags.join(", ") : "",
    context: typeof initial.context === "string" ? initial.context : "",
    contribution:
      typeof initial.contribution === "string" ? initial.contribution : "",
    outcome: typeof initial.outcome === "string" ? initial.outcome : "",
    publicationStatus: project.publicationStatus,
    visibility: project.visibility,
    sortOrder: project.sortOrder,
    includeInAi: project.includeInAi,
    source: project.source ?? "",
    reviewNotes: project.reviewNotes ?? "",
  });
  const [links, setLinks] = useState(project.links);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch(`/api/admin/projects/${project.id}/assets`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { assets?: Asset[] } | null) => setAssets(b?.assets ?? []));
  }, [project.id]);
  async function responseError(r: Response, fallback: string) {
    const b = (await r.json().catch(() => null)) as { error?: unknown } | null;
    return typeof b?.error === "string" ? b.error : fallback;
  }
  const update = (patch: Partial<typeof draft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setLinks((items) =>
      arrayMove(
        items,
        items.findIndex((i) => i.id === active.id),
        items.findIndex((i) => i.id === over.id),
      ).map((i, sortOrder) => ({ ...i, sortOrder })),
    );
  }
  function addLink() {
    setLinks((items) => [
      ...items,
      {
        id: clientId(),
        label: "New link",
        url: "https://example.com",
        sortOrder: items.length,
      },
    ]);
  }
  async function restore(revisionId: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/projects/${project.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId }),
      });
      if (!r.ok)
        throw new Error(await responseError(r, "Unable to restore revision"));
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to restore revision");
    } finally {
      setBusy(false);
    }
  }
  async function uploadAsset(file: File) {
    const form = new FormData();
    form.set("file", file);
    const r = await fetch(`/api/admin/projects/${project.id}/assets`, {
      method: "POST",
      body: form,
    });
    if (!r.ok)
      throw new Error(await responseError(r, "Unable to upload asset"));
    const b = (await r.json()) as { asset: Asset };
    setAssets((items) => [b.asset, ...items]);
  }
  async function deleteAsset(assetId: string) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`/api/admin/projects/${project.id}/assets`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
      });
      if (!r.ok)
        throw new Error(await responseError(r, "Unable to delete asset"));
      setAssets((items) => items.filter((asset) => asset.id !== assetId));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to delete asset");
    } finally {
      setBusy(false);
    }
  }
  async function save(publish = false) {
    setBusy(true);
    setMessage("");
    try {
      const existing = JSON.parse(draft.details) as ProjectDetails;
      const details = {
        ...existing,
        tags: draft.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        context: draft.context,
        contribution: draft.contribution,
        outcome: draft.outcome,
      };
      const r = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          details,
          publicationStatus: draft.publicationStatus,
          sortOrder: Number(draft.sortOrder),
          links: links.map((link, sortOrder) => ({ ...link, sortOrder })),
        }),
      });
      if (!r.ok)
        throw new Error(await responseError(r, "Unable to save draft"));
      if (publish) {
        const p = await fetch(`/api/admin/projects/${project.id}/publish`, {
          method: "POST",
        });
        if (!p.ok) throw new Error(await responseError(p, "Unable to publish"));
      }
      setMessage(
        publish
          ? "Published successfully."
          : "Draft saved. Public content is unchanged.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="admin-heading">
        <div>
          <Link href="/admin" className="admin-back">
            ← Workspace
          </Link>
          <h1>{project.title}</h1>
        </div>
        <div className="admin-actions">
          <Link
            className="admin-button admin-button-muted"
            href={`/projects/${project.slug}?preview=1`}
            target="_blank"
          >
            Preview draft
          </Link>
          <button
            className="admin-button admin-button-muted"
            onClick={() => save()}
            disabled={busy}
          >
            Save draft
          </button>
          <button
            className="admin-button admin-button-primary"
            onClick={() => save(true)}
            disabled={busy}
          >
            Publish
          </button>
        </div>
      </div>
      {message && (
        <p className="admin-notice" role="status">
          {message}
        </p>
      )}
      <div className="admin-card admin-editor">
        <p className="admin-help-text">
          Save draft keeps changes private. Publish makes them public.
        </p>
        <div className="admin-form-grid">
          <label>
            Title
            <input
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>
          <label>
            Slug
            <input
              value={draft.slug}
              onChange={(e) => update({ slug: e.target.value })}
            />
          </label>
          <label>
            Category
            <select
              value={draft.categoryId}
              onChange={(e) => update({ categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Visibility
            <select
              value={draft.visibility}
              onChange={(e) =>
                update({ visibility: e.target.value as Project["visibility"] })
              }
            >
              <option>PUBLIC</option>
              <option>PRIVATE</option>
              <option>UNLISTED</option>
            </select>
          </label>
        </div>
        <label>
          Summary
          <textarea
            rows={4}
            value={draft.summary}
            onChange={(e) => update({ summary: e.target.value })}
          />
        </label>
        <div className="admin-form-grid">
          <label>
            Tags <span className="admin-help-text">Comma-separated</span>
            <input
              value={draft.tags}
              onChange={(e) => update({ tags: e.target.value })}
            />
          </label>
          <label>
            Context
            <textarea
              rows={3}
              value={draft.context}
              onChange={(e) => update({ context: e.target.value })}
            />
          </label>
          <label>
            My contribution
            <textarea
              rows={3}
              value={draft.contribution}
              onChange={(e) => update({ contribution: e.target.value })}
            />
          </label>
          <label>
            Outcome
            <textarea
              rows={3}
              value={draft.outcome}
              onChange={(e) => update({ outcome: e.target.value })}
            />
          </label>
        </div>
        <details>
          <summary>Advanced details JSON</summary>
          <p className="admin-help-text">
            Optional: use this only for extra fields.
          </p>
          <textarea
            rows={8}
            value={draft.details}
            onChange={(e) => update({ details: e.target.value })}
          />
        </details>
        <div className="admin-form-grid">
          <label>
            Source/provenance
            <textarea
              rows={3}
              value={draft.source}
              onChange={(e) => update({ source: e.target.value })}
            />
          </label>
          <label>
            Review notes
            <textarea
              rows={3}
              value={draft.reviewNotes}
              onChange={(e) => update({ reviewNotes: e.target.value })}
            />
          </label>
        </div>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={draft.includeInAi}
            onChange={(e) => update({ includeInAi: e.target.checked })}
          />{" "}
          Include in AI knowledge{" "}
          <span className="admin-help-text">
            Only published, public content is used.
          </span>
        </label>
        <div className="admin-card-heading">
          <h2>Links and order</h2>
          <button
            type="button"
            className="admin-button admin-button-muted"
            onClick={addLink}
          >
            Add link
          </button>
        </div>
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={links.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {links.map((item, index) => (
              <SortableLink
                key={item.id}
                item={{ ...item, sortOrder: index }}
                onChange={(patch) =>
                  setLinks((items) =>
                    items.map((current) =>
                      current.id === item.id
                        ? { ...current, ...patch }
                        : current,
                    ),
                  )
                }
                onRemove={() =>
                  setLinks((items) =>
                    items.filter((current) => current.id !== item.id),
                  )
                }
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <div className="admin-card">
        <div className="admin-card-heading">
          <h2>Assets</h2>
          <label className="admin-button admin-button-muted">
            Upload asset
            <input
              type="file"
              hidden
              accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void uploadAsset(file).catch((error: unknown) =>
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Unable to upload asset",
                    ),
                  );
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        {assets.length ? (
          <ul className="admin-list">
            {assets.map((asset) => (
              <li key={asset.id}>
                <span>
                  <strong>{asset.kind}</strong>
                  <span>{asset.altText || "No alt text"}</span>
                </span>
                    <span>
                      <a
                        href={`/api/admin/projects/${project.id}/assets?assetId=${encodeURIComponent(asset.id)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                      {" "}
                      <button
                        type="button"
                        className="admin-button admin-button-danger"
                        onClick={() => void deleteAsset(asset.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No assets uploaded.</p>
        )}
      </div>
      <div className="admin-card">
        <h2>Revision history</h2>
        <ul className="admin-list">
          {project.revisions.map((revision) => (
            <li key={revision.id}>
              <span>
                <strong>Version {revision.version}</strong>
                <span>{revision.status}</span>
              </span>
              <span>
                {new Date(revision.createdAt).toLocaleString()}{" "}
                <button
                  type="button"
                  className="admin-button admin-button-muted"
                  onClick={() => restore(revision.id)}
                  disabled={busy}
                >
                  Restore as draft
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
