"use client";
import Link from "next/link";
import { useState } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import VisualEditor from "@/components/admin/visual-editor/VisualEditor";
import {
  defaultVisualDocument,
  parseVisualPageDocument,
  type VisualPageDocument,
} from "@/lib/visual-editor";
type Block = {
  id: string;
  blockKey: string;
  kind: string;
  sortOrder: number;
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
  includeInAi: boolean;
  data: unknown;
};
type EditableBlock = Block & { dataText: string };
type Page = {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  blocks: Block[];
  revisions: Array<{
    id: string;
    version: number;
    status: string;
    createdAt: Date | string;
  }>;
};
type OverviewData = {
  name?: string;
  headline?: string;
  shortBio?: string;
  longBio?: string;
  skills?: string[];
  links?: Array<{ label?: string; url?: string; visibility?: string; publicationStatus?: string }>;
  resumeAsset?: { path?: string; publicationStatus?: string } | null;
  portraitAsset?: { path?: string } | null;
  [key: string]: unknown;
};
type OverviewEnvelope = { overview?: OverviewData; [key: string]: unknown };

function overviewForDefaults(block: Block | undefined) {
  if (!block?.data || typeof block.data !== "object") return undefined;
  const envelope = block.data as OverviewEnvelope;
  const value = envelope.overview && typeof envelope.overview === "object"
    ? envelope.overview
    : envelope;
  return {
    name: typeof value.name === "string" ? value.name : undefined,
    headline: typeof value.headline === "string" ? value.headline : undefined,
    shortBio: typeof value.shortBio === "string" ? value.shortBio : undefined,
    longBio: typeof value.longBio === "string" ? value.longBio : undefined,
  };
}
function clientId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
function OverviewFields({
  block,
  onChange,
}: {
  block: EditableBlock;
  onChange: (patch: Partial<EditableBlock>) => void;
}) {
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeMessage, setResumeMessage] = useState("");
  let envelope: OverviewEnvelope = {};
  try {
    envelope = JSON.parse(block.dataText) as OverviewEnvelope;
  } catch {
    return (
      <p className="admin-error">
        The advanced JSON is invalid. Fix it below before saving.
      </p>
    );
  }
  const nested = envelope.overview && typeof envelope.overview === "object";
  const data = nested
    ? (envelope.overview as OverviewData)
    : (envelope as OverviewData);
  const set = (key: string, value: unknown) => {
    const nextOverview = { ...data, [key]: value };
    const nextData = nested
      ? { ...envelope, overview: nextOverview }
      : nextOverview;
    onChange({ dataText: JSON.stringify(nextData, null, 2) });
  };
  const linkUrl = (label: string) => {
    const link = data.links?.find((item) => item.label?.toLowerCase() === label.toLowerCase());
    return link?.url ?? "";
  };
  const setLink = (label: string, url: string) => {
    const links = Array.isArray(data.links) ? [...data.links] : [];
    const index = links.findIndex((item) => item.label?.toLowerCase() === label.toLowerCase());
    const next = { label, url, visibility: "PUBLIC", publicationStatus: "PUBLIC" };
    if (index >= 0) links[index] = { ...links[index], ...next };
    else links.push(next);
    set("links", links.filter((item) => item.url?.trim()));
  };
  async function uploadResume(file: File | undefined) {
    if (!file) return;
    setUploadingResume(true);
    setResumeMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/admin/portfolio-assets", { method: "POST", body: form });
      const payload = await response.json().catch(() => null) as { asset?: { path?: string }; error?: string } | null;
      if (!response.ok || !payload?.asset?.path) throw new Error(payload?.error || "Unable to upload the resume");
      set("resumeAsset", { ...(data.resumeAsset ?? {}), path: payload.asset.path, publicationStatus: "PUBLIC" });
      setResumeMessage("Uploaded. Save and publish this page to make it live.");
    } catch (error) {
      setResumeMessage(error instanceof Error ? error.message : "Unable to upload the resume");
    } finally {
      setUploadingResume(false);
    }
  }
  return (
    <>
      <div className="admin-form-grid">
        <label>
          Name
          <input
            value={data.name ?? ""}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label>
          Headline
          <input
            value={data.headline ?? ""}
            onChange={(e) => set("headline", e.target.value)}
          />
        </label>
        <label>
          Skills <span className="admin-help-text">Comma-separated</span>
          <input
            value={Array.isArray(data.skills) ? data.skills.join(", ") : ""}
            onChange={(e) =>
              set(
                "skills",
                e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              )
            }
          />
        </label>
        <label>
          Resume download
          <input
            value={data.resumeAsset?.path ?? ""}
            onChange={(e) =>
              set("resumeAsset", {
                ...(data.resumeAsset ?? {}),
                path: e.target.value,
              })
            }
          />
          <span className="admin-help-text">Current path. Upload a replacement below.</span>
          <input type="file" accept="application/pdf,.pdf" disabled={uploadingResume} onChange={(e) => uploadResume(e.target.files?.[0])} />
          {resumeMessage ? <span className="admin-help-text" role="status">{resumeMessage}</span> : null}
        </label>
        <label>
          Portrait asset path
          <input
            value={data.portraitAsset?.path ?? ""}
            onChange={(e) =>
              set("portraitAsset", {
                ...(data.portraitAsset ?? {}),
                path: e.target.value,
              })
            }
          />
        </label>
      </div>
      <div className="admin-form-grid">
        <label>
          LinkedIn button URL
          <input type="url" value={linkUrl("LinkedIn")} placeholder="https://linkedin.com/in/..." onChange={(e) => setLink("LinkedIn", e.target.value)} />
        </label>
        <label>
          GitHub button URL
          <input type="url" value={linkUrl("GitHub")} placeholder="https://github.com/..." onChange={(e) => setLink("GitHub", e.target.value)} />
        </label>
      </div>
      <label>
        Short bio
        <textarea
          rows={3}
          value={data.shortBio ?? ""}
          onChange={(e) => set("shortBio", e.target.value)}
        />
      </label>
      <label>
        Long bio
        <textarea
          rows={6}
          value={data.longBio ?? ""}
          onChange={(e) => set("longBio", e.target.value)}
        />
      </label>
      <details>
        <summary>Advanced overview JSON</summary>
        <p className="admin-help-text">
          Use this for extra fields such as links or education.
        </p>
        <textarea
          rows={8}
          value={block.dataText}
          onChange={(e) => onChange({ dataText: e.target.value })}
        />
      </details>
    </>
  );
}
function SortableBlock({
  block,
  index,
  onChange,
  onRemove,
}: {
  block: EditableBlock;
  index: number;
  onChange: (patch: Partial<EditableBlock>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: block.id });
  const isOverview =
    block.kind === "overview" || block.blockKey === "overview-content";
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="admin-block"
    >
      <div className="admin-block-heading">
        <strong>
          {index + 1}. {block.blockKey}
        </strong>
        <span>{block.kind}</span>
      </div>
      <div className="admin-form-grid">
        <label>
          Block key
          <input
            value={block.blockKey}
            onChange={(e) => onChange({ blockKey: e.target.value })}
          />
        </label>
        <label>
          Kind
          <input
            value={block.kind}
            onChange={(e) => onChange({ kind: e.target.value })}
          />
        </label>
        <label>
          Visibility
          <select
            value={block.visibility}
            onChange={(e) =>
              onChange({ visibility: e.target.value as Block["visibility"] })
            }
          >
            <option>PUBLIC</option>
            <option>UNLISTED</option>
            <option>PRIVATE</option>
          </select>
        </label>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={block.includeInAi}
            onChange={(e) => onChange({ includeInAi: e.target.checked })}
          />{" "}
          Include in AI knowledge
        </label>
      </div>
      {isOverview ? (
        <OverviewFields block={block} onChange={onChange} />
      ) : (
        <label>
          Copy/data JSON
          <textarea
            rows={8}
            value={block.dataText}
            onChange={(e) => onChange({ dataText: e.target.value })}
          />
        </label>
      )}
      <div className="admin-inline-actions">
        <button
          type="button"
          className="drag-handle"
          {...attributes}
          {...listeners}
        >
          ↕ Reorder
        </button>
        <button
          type="button"
          className="admin-button admin-button-danger"
          onClick={onRemove}
        >
          Remove block
        </button>
      </div>
    </div>
  );
}
export function PageEditor({ page }: { page: Page }) {
  const storedVisual = page.blocks.find((block) => block.kind === "visual-layout");
  const overviewBlock = page.blocks.find(
    (block) => block.kind === "overview" || block.blockKey === "overview-content",
  );
  const [title, setTitle] = useState(page.title);
  const [visualDocument, setVisualDocument] = useState<VisualPageDocument>(
    () => parseVisualPageDocument(storedVisual?.data)
      ?? defaultVisualDocument(page.slug, overviewForDefaults(overviewBlock)),
  );
  const [blocks, setBlocks] = useState<EditableBlock[]>(
    page.blocks.filter((block) => block.kind !== "visual-layout").map((b) => ({
      ...b,
      dataText: JSON.stringify(b.data, null, 2),
    })),
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function error(r: Response, fallback: string) {
    const b = (await r.json().catch(() => null)) as { error?: unknown } | null;
    return typeof b?.error === "string" ? b.error : fallback;
  }
  function updateBlock(id: string, patch: Partial<EditableBlock>) {
    setBlocks((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }
  function drag(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setBlocks((items) =>
      arrayMove(
        items,
        items.findIndex((i) => i.id === active.id),
        items.findIndex((i) => i.id === over.id),
      ),
    );
  }
  function addBlock() {
    setBlocks((items) => [
      ...items,
      {
        id: clientId(),
        blockKey: `block-${items.length + 1}`,
        kind: "text",
        sortOrder: items.length,
        visibility: "PRIVATE",
        includeInAi: false,
        data: {},
        dataText: '{\n  "text": ""\n}',
      },
    ]);
  }
  async function restore(revisionId: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/pages/${page.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId }),
      });
      if (!r.ok) throw new Error(await error(r, "Unable to restore revision"));
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to restore revision");
    } finally {
      setBusy(false);
    }
  }
  async function save(publish = false) {
    setBusy(true);
    setMessage("");
    try {
      const parsed = blocks.map(({ dataText, blockKey, kind, visibility, includeInAi }, sortOrder) => ({
        blockKey,
        kind,
        visibility,
        includeInAi,
        sortOrder,
        data: JSON.parse(dataText) as Record<string, unknown>,
      }));
      parsed.push({
        blockKey: "visual-layout",
        kind: "visual-layout",
        sortOrder: parsed.length,
        visibility: "PUBLIC",
        includeInAi: false,
        data: visualDocument,
      });
      const r = await fetch(`/api/admin/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, blocks: parsed }),
      });
      if (!r.ok) throw new Error(await error(r, "Unable to save draft"));
      if (publish) {
        const p = await fetch(`/api/admin/pages/${page.id}/publish`, {
          method: "POST",
        });
        if (!p.ok) throw new Error(await error(p, "Unable to publish"));
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
  const previewPath = page.slug === "work"
    ? "/work?preview=1"
    : page.slug === "ai"
      ? "/ai?preview=1"
      : "/?preview=1";
  return (
    <div>
      <div className="admin-heading">
        <div>
          <Link href="/admin" className="admin-back">
            ← Workspace
          </Link>
          <h1>{page.title}</h1>
        </div>
        <div className="admin-actions">
          <Link
            className="admin-button admin-button-muted"
            href={previewPath}
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
      <p className="admin-help-text">Save draft keeps changes private. Preview checks the draft on the real site. Publish makes the current draft public.</p>
      <VisualEditor document={visualDocument} onDocumentChange={setVisualDocument} pageTitle={title} onPageTitleChange={setTitle} />
      <details className="admin-card admin-editor admin-advanced-data">
        <summary>Dynamic content and advanced data</summary>
        <p className="admin-help-text">Skills, profile links, résumé paths, and other managed data used by visual blocks live here. Most layout and copy changes should be made in the visual editor above.</p>
        <div className="admin-card-heading">
          <h2>Managed data blocks</h2>
          <button type="button" className="admin-button admin-button-muted" onClick={addBlock}>Add data block</button>
        </div>
        <DndContext collisionDetection={closestCenter} onDragEnd={drag}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((block, index) => (
              <SortableBlock key={block.id} block={{ ...block, sortOrder: index }} index={index} onChange={(patch) => updateBlock(block.id, patch)} onRemove={() => setBlocks((items) => items.filter((item) => item.id !== block.id))} />
            ))}
          </SortableContext>
        </DndContext>
      </details>
      <div className="admin-card">
        <h2>Revision history</h2>
        <ul className="admin-list">
          {page.revisions.map((revision) => (
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
