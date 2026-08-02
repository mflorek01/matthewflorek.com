"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  visualPageDocumentSchema,
  type VisualBlock,
  type VisualPageDocument,
} from "@/lib/visual-editor";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./VisualEditor.module.css";

export type VisualEditorProps = {
  document: VisualPageDocument;
  onDocumentChange: (document: VisualPageDocument) => void;
  pageTitle: string;
  onPageTitleChange: (title: string) => void;
  className?: string;
};

type PreviewMode = "desktop" | "tablet" | "mobile";
type Snapshot = { document: VisualPageDocument; title: string };

const blockTypes: Array<{ type: VisualBlock["type"]; label: string; icon: string }> = [
  { type: "hero", label: "Hero", icon: "H" },
  { type: "heading", label: "Heading", icon: "T" },
  { type: "text", label: "Text", icon: "¶" },
  { type: "button", label: "Button", icon: "↗" },
  { type: "image", label: "Image", icon: "▧" },
  { type: "spacer", label: "Spacer", icon: "↕" },
  { type: "divider", label: "Divider", icon: "—" },
  { type: "projects", label: "Projects", icon: "▦" },
  { type: "chat", label: "Chat", icon: "◇" },
  { type: "orbit", label: "Orbit", icon: "◎" },
  { type: "skills", label: "Skills", icon: "⌁" },
  { type: "profile-links", label: "Profile links", icon: "⌘" },
];

const baseStyle: VisualBlock["style"] = {
  desktopSpan: 12,
  tabletSpan: 12,
  mobileSpan: 12,
  align: "left",
  paddingTop: 16,
  paddingBottom: 16,
  paddingInline: 0,
  background: "transparent",
  textColor: "#10213f",
  borderRadius: 0,
  fontSize: "body",
};

function newContent(type: VisualBlock["type"]): VisualBlock["content"] {
  switch (type) {
    case "hero": return { text: "Matthew Florek", headline: "Data analysis with a builder's range", body: "Explain the work you do and why it matters.", primaryLabel: "See selected work", primaryHref: "/work", secondaryLabel: "Explore AI projects", secondaryHref: "/ai" };
    case "heading": return { level: "h2", text: "A clear, confident heading" };
    case "text": return { text: "Add a concise, useful paragraph here." };
    case "button": return { label: "Learn more", href: "/", variant: "primary" };
    case "image": return { src: "", alt: "" };
    case "spacer": return { height: 48 };
    case "projects": return { category: "WORK" };
    default: return {};
  }
}

function createBlock(type: VisualBlock["type"], index: number): VisualBlock {
  return {
    id: `visual-${Date.now().toString(36)}-${index}`,
    type,
    content: newContent(type),
    style: { ...baseStyle },
  };
}

function cloneDocument(document: VisualPageDocument): VisualPageDocument {
  return {
    version: 1,
    blocks: document.blocks.map((block) => ({
      ...block,
      content: { ...block.content },
      style: { ...block.style },
    })),
  };
}

function blockName(type: VisualBlock["type"]) {
  return type === "profile-links" ? "Profile links" : `${type[0].toUpperCase()}${type.slice(1)}`;
}

function EditableText({
  as: Tag,
  value,
  className,
  onChange,
}: {
  as: "h1" | "h2" | "h3" | "p" | "span";
  value: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  const elementRef = useRef<HTMLElement | null>(null);
  const editingRef = useRef(false);
  const lastInputValueRef = useRef(value);

  // Do not give React a text child here. React reconciling that child after
  // every input is what causes the browser to lose its caret position.
  // Instead, the browser owns the text node while editing and this effect
  // applies only actual external changes (inspector edits, undo/redo, or a
  // newly selected block).
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const currentValue = element.textContent ?? "";
    if (currentValue === value) {
      lastInputValueRef.current = value;
      return;
    }

    const valueIsFromThisEditor = lastInputValueRef.current === value;
    if (!editingRef.current || valueIsFromThisEditor) {
      element.textContent = value;
      lastInputValueRef.current = value;
    }
  }, [value]);

  return (
    <Tag
      ref={(element: HTMLElement | null) => {
        elementRef.current = element;
      }}
      className={className}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-label="Edit text"
      aria-multiline="true"
      onFocus={() => {
        editingRef.current = true;
      }}
      onInput={(event) => {
        const nextValue = event.currentTarget.textContent ?? "";
        lastInputValueRef.current = nextValue;
        onChange(nextValue);
      }}
      onBlur={() => {
        editingRef.current = false;
        const nextValue = elementRef.current?.textContent ?? "";
        if (nextValue === value) return;

        // If another control changed the value while this surface had focus,
        // prefer that external value. Otherwise this is a final browser edit
        // that has not reached the parent yet, so commit it once.
        if (lastInputValueRef.current === nextValue) {
          if (elementRef.current) elementRef.current.textContent = value;
          lastInputValueRef.current = value;
        } else {
          lastInputValueRef.current = nextValue;
          onChange(nextValue);
        }
      }}
    />
  );
}

function BlockContent({ block, onContent }: { block: VisualBlock; onContent: (content: VisualBlock["content"]) => void }) {
  const content = block.content;
  switch (block.type) {
    case "hero":
      return <div className={styles.heroPreview}><div><EditableText as="h1" className={styles.headingPreview} value={content.text ?? ""} onChange={(text) => onContent({ ...content, text })} /><EditableText as="p" className={styles.heroHeadline} value={content.headline ?? ""} onChange={(headline) => onContent({ ...content, headline })} /><EditableText as="p" className={styles.textPreview} value={content.body ?? ""} onChange={(body) => onContent({ ...content, body })} /><span className={styles.buttonPreview}>{content.primaryLabel}</span></div><div className={styles.heroOrb}><span /><i /></div></div>;
    case "heading": {
      const level = content.level ?? "h2";
      return <EditableText as={level} className={styles.headingPreview} value={content.text ?? ""} onChange={(text) => onContent({ ...content, text })} />;
    }
    case "text":
      return <EditableText as="p" className={styles.textPreview} value={content.text ?? ""} onChange={(text) => onContent({ ...content, text })} />;
    case "button":
      return <EditableText as="span" className={`${styles.buttonPreview} ${styles[`button_${content.variant ?? "primary"}`]}`} value={content.label ?? ""} onChange={(label) => onContent({ ...content, label })} />;
    case "image":
      return content.src ? (
        // Editor previews accept user-selected hosts that are not known to next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.imagePreview} src={content.src} alt={content.alt ?? ""} />
      ) : <div className={styles.imagePlaceholder}><span>▧</span><strong>Choose an image</strong></div>;
    case "spacer":
      return <div className={styles.spacerPreview} style={{ height: content.height ?? 48 }}><span>{content.height ?? 48}px</span></div>;
    case "divider":
      return <hr className={styles.dividerPreview} />;
    case "projects":
      return <div className={styles.projectsPreview}><strong>{content.category === "AI" ? "AI projects" : "Selected work"}</strong><div><span /><span /><span /></div></div>;
    case "chat":
      return <div className={styles.chatPreview}><span className={styles.chatIcon}>◇</span><div><strong>Ask about my work</strong><small>Start a conversation about projects and experience.</small></div><span>→</span></div>;
    case "orbit":
      return <div className={styles.orbitPreview}><span className={styles.orbitRingOne} /><span className={styles.orbitRingTwo} /><i className={styles.orbitCore} /><em className={styles.orbitData}>DATA</em><em className={styles.orbitAi}>AI</em><em className={styles.orbitOps}>OPS</em></div>;
    case "skills":
      return <div className={styles.skillsPreview}><strong>Capabilities</strong><div><span>Data analysis</span><span>Systems design</span><span>Applied AI</span><span>Product thinking</span></div></div>;
    case "profile-links":
      return <div className={styles.linksPreview}><strong>Connect</strong><span>LinkedIn ↗</span><span>GitHub ↗</span><span>Email ↗</span></div>;
  }
}

function SortableBlock({
  block,
  mode,
  selected,
  onSelect,
  onChange,
  onDuplicate,
  onDelete,
}: {
  block: VisualBlock;
  mode: PreviewMode;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<VisualBlock>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const span = mode === "desktop" ? block.style.desktopSpan : mode === "tablet" ? block.style.tabletSpan : block.style.mobileSpan;
  const surfaceStyle = {
    "--block-background": block.style.background,
    "--block-text": block.style.textColor,
    "--block-radius": `${block.style.borderRadius}px`,
    "--block-pad-top": `${block.style.paddingTop}px`,
    "--block-pad-bottom": `${block.style.paddingBottom}px`,
    "--block-pad-inline": `${block.style.paddingInline}px`,
  } as CSSProperties;

  return (
    <div
      ref={setNodeRef}
      className={`${styles.block} ${selected ? styles.selected : ""} ${isDragging ? styles.dragging : ""}`}
      style={{ gridColumn: `span ${span}`, transform: CSS.Transform.toString(transform), transition }}
    >
      <div className={styles.blockToolbar}>
        <button type="button" className={styles.dragHandle} aria-label={`Move ${blockName(block.type)} block`} {...attributes} {...listeners}>⠿</button>
        <button type="button" className={styles.blockName} onClick={onSelect}>{blockName(block.type)}</button>
        <span />
        <button type="button" onClick={onDuplicate} aria-label={`Duplicate ${blockName(block.type)} block`}>⧉</button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${blockName(block.type)} block`}>×</button>
      </div>
      <div
        className={`${styles.blockSurface} ${styles[`align_${block.style.align}`]} ${styles[`font_${block.style.fontSize}`]}`}
        style={surfaceStyle}
        role="button"
        tabIndex={0}
        aria-label={`Select ${blockName(block.type)} block`}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
      >
        <BlockContent block={block} onContent={(content) => onChange({ content })} />
      </div>
    </div>
  );
}

function NumberControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className={styles.field}>{label}<input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} /></label>;
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return <fieldset className={styles.segmented}><legend>{label}</legend><div>{options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} className={value === option.value ? styles.segmentActive : ""} onClick={() => onChange(option.value)}>{option.label}</button>)}</div></fieldset>;
}

function ContentInspector({ block, onChange }: { block: VisualBlock; onChange: (content: VisualBlock["content"]) => void }) {
  const content = block.content;
  if (block.type === "hero") return <><label className={styles.field}>Name<input value={content.text ?? ""} onChange={(event) => onChange({ ...content, text: event.target.value })} /></label><label className={styles.field}>Headline<textarea rows={2} value={content.headline ?? ""} onChange={(event) => onChange({ ...content, headline: event.target.value })} /></label><label className={styles.field}>Introduction<textarea rows={4} value={content.body ?? ""} onChange={(event) => onChange({ ...content, body: event.target.value })} /></label><div className={styles.twoColumns}><label className={styles.field}>Primary label<input value={content.primaryLabel ?? ""} onChange={(event) => onChange({ ...content, primaryLabel: event.target.value })} /></label><label className={styles.field}>Primary link<input value={content.primaryHref ?? ""} onChange={(event) => onChange({ ...content, primaryHref: event.target.value })} /></label><label className={styles.field}>Secondary label<input value={content.secondaryLabel ?? ""} onChange={(event) => onChange({ ...content, secondaryLabel: event.target.value })} /></label><label className={styles.field}>Secondary link<input value={content.secondaryHref ?? ""} onChange={(event) => onChange({ ...content, secondaryHref: event.target.value })} /></label></div></>;
  if (block.type === "heading") return <><label className={styles.field}>Text<textarea rows={3} value={content.text ?? ""} onChange={(event) => onChange({ ...content, text: event.target.value })} /></label><label className={styles.field}>Heading level<select value={content.level ?? "h2"} onChange={(event) => onChange({ ...content, level: event.target.value as "h1" | "h2" | "h3" })}><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option></select></label></>;
  if (block.type === "text") return <label className={styles.field}>Text<textarea rows={5} value={content.text ?? ""} onChange={(event) => onChange({ ...content, text: event.target.value })} /></label>;
  if (block.type === "button") return <><label className={styles.field}>Label<input value={content.label ?? ""} onChange={(event) => onChange({ ...content, label: event.target.value })} /></label><label className={styles.field}>Link<input value={content.href ?? ""} onChange={(event) => onChange({ ...content, href: event.target.value })} placeholder="/work" /></label><label className={styles.field}>Style<select value={content.variant ?? "primary"} onChange={(event) => onChange({ ...content, variant: event.target.value as "primary" | "secondary" | "text" })}><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="text">Text link</option></select></label></>;
  if (block.type === "image") return <><label className={styles.field}>Image URL<input value={content.src ?? ""} onChange={(event) => onChange({ ...content, src: event.target.value })} /></label><label className={styles.field}>Alternative text<input value={content.alt ?? ""} onChange={(event) => onChange({ ...content, alt: event.target.value })} /></label></>;
  if (block.type === "spacer") return <NumberControl label="Height" value={content.height ?? 48} min={8} max={400} onChange={(height) => onChange({ ...content, height })} />;
  if (block.type === "projects") return <label className={styles.field}>Project category<select value={content.category ?? "WORK"} onChange={(event) => onChange({ ...content, category: event.target.value as "WORK" | "AI" })}><option value="WORK">Work</option><option value="AI">AI</option></select></label>;
  return <p className={styles.contentNote}>This block uses the site’s managed content and has no local content fields.</p>;
}

function Inspector({ block, onChange }: { block: VisualBlock; onChange: (patch: Partial<VisualBlock>) => void }) {
  const updateStyle = (patch: Partial<VisualBlock["style"]>) => onChange({ style: { ...block.style, ...patch } });
  return (
    <aside className={styles.inspector} aria-label="Block inspector">
      <div className={styles.inspectorTitle}><h2>{blockName(block.type)}</h2><p>Content, layout, and appearance</p></div>
      <section className={styles.inspectorSection}><h3>Content</h3><ContentInspector block={block} onChange={(content) => onChange({ content })} /></section>
      <section className={styles.inspectorSection}>
        <h3>Responsive width</h3>
        <div className={styles.threeColumns}>
          <NumberControl label="Desktop" value={block.style.desktopSpan} min={1} max={12} onChange={(desktopSpan) => updateStyle({ desktopSpan })} />
          <NumberControl label="Tablet" value={block.style.tabletSpan} min={1} max={12} onChange={(tabletSpan) => updateStyle({ tabletSpan })} />
          <NumberControl label="Mobile" value={block.style.mobileSpan} min={1} max={12} onChange={(mobileSpan) => updateStyle({ mobileSpan })} />
        </div>
        <Segmented label="Alignment" value={block.style.align} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} onChange={(align) => updateStyle({ align })} />
      </section>
      <section className={styles.inspectorSection}>
        <h3>Spacing</h3>
        <div className={styles.threeColumns}>
          <NumberControl label="Top" value={block.style.paddingTop} min={0} max={200} onChange={(paddingTop) => updateStyle({ paddingTop })} />
          <NumberControl label="Bottom" value={block.style.paddingBottom} min={0} max={200} onChange={(paddingBottom) => updateStyle({ paddingBottom })} />
          <NumberControl label="Inline" value={block.style.paddingInline} min={0} max={120} onChange={(paddingInline) => updateStyle({ paddingInline })} />
        </div>
        <NumberControl label="Border radius" value={block.style.borderRadius} min={0} max={60} onChange={(borderRadius) => updateStyle({ borderRadius })} />
      </section>
      <section className={styles.inspectorSection}>
        <h3>Color and type</h3>
        <div className={styles.twoColumns}>
          <label className={styles.field}>Background<div className={styles.colorControl}><input type="color" value={block.style.background === "transparent" ? "#ffffff" : block.style.background} onChange={(event) => updateStyle({ background: event.target.value })} /><button type="button" onClick={() => updateStyle({ background: "transparent" })}>Clear</button></div></label>
          <label className={styles.field}>Text color<input type="color" value={block.style.textColor} onChange={(event) => updateStyle({ textColor: event.target.value })} /></label>
        </div>
        <label className={styles.field}>Font size<select value={block.style.fontSize} onChange={(event) => updateStyle({ fontSize: event.target.value as VisualBlock["style"]["fontSize"] })}><option value="small">Small</option><option value="body">Body</option><option value="large">Large</option><option value="title">Title</option><option value="display">Display</option></select></label>
      </section>
    </aside>
  );
}

export default function VisualEditor({ document, onDocumentChange, pageTitle, onPageTitleChange, className }: VisualEditorProps) {
  const [draft, setDraft] = useState<VisualPageDocument>(() => cloneDocument(document));
  const [title, setTitle] = useState(pageTitle);
  const [selectedId, setSelectedId] = useState<string | null>(document.blocks[0]?.id ?? null);
  const [mode, setMode] = useState<PreviewMode>("desktop");
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => setDraft(cloneDocument(document)), [document]);
  useEffect(() => setTitle(pageTitle), [pageTitle]);

  const selected = draft.blocks.find((block) => block.id === selectedId) ?? null;
  const previewClass = useMemo(() => `${styles.preview} ${styles[`preview_${mode}`]}`, [mode]);

  function emit(nextDocument: VisualPageDocument, nextTitle = title, remember = true) {
    const parsed = visualPageDocumentSchema.safeParse(nextDocument);
    if (!parsed.success) return;
    if (remember) {
      setPast((history) => [...history.slice(-39), { document: cloneDocument(draft), title }]);
      setFuture([]);
    }
    setDraft(parsed.data);
    setTitle(nextTitle);
    onDocumentChange(parsed.data);
    if (nextTitle !== title) onPageTitleChange(nextTitle);
  }

  function updateBlock(id: string, patch: Partial<VisualBlock>) {
    emit({ version: 1, blocks: draft.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) });
  }

  function addBlock(type: VisualBlock["type"]) {
    if (draft.blocks.length >= 100) return;
    const block = createBlock(type, draft.blocks.length);
    setSelectedId(block.id);
    emit({ version: 1, blocks: [...draft.blocks, block] });
  }

  function duplicateBlock(id: string) {
    if (draft.blocks.length >= 100) return;
    const index = draft.blocks.findIndex((block) => block.id === id);
    if (index < 0) return;
    const source = draft.blocks[index];
    const copy: VisualBlock = { ...source, id: `visual-${Date.now().toString(36)}-copy`, content: { ...source.content }, style: { ...source.style } };
    const blocks = [...draft.blocks.slice(0, index + 1), copy, ...draft.blocks.slice(index + 1)];
    setSelectedId(copy.id);
    emit({ version: 1, blocks });
  }

  function deleteBlock(id: string) {
    const blocks = draft.blocks.filter((block) => block.id !== id);
    setSelectedId(blocks[Math.min(draft.blocks.findIndex((block) => block.id === id), blocks.length - 1)]?.id ?? null);
    emit({ version: 1, blocks });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = draft.blocks.findIndex((block) => block.id === active.id);
    const to = draft.blocks.findIndex((block) => block.id === over.id);
    if (from < 0 || to < 0) return;
    emit({ version: 1, blocks: arrayMove(draft.blocks, from, to) });
  }

  function restore(snapshot: Snapshot, direction: "undo" | "redo") {
    const current = { document: cloneDocument(draft), title };
    if (direction === "undo") setFuture((history) => [current, ...history]);
    else setPast((history) => [...history, current]);
    emit(snapshot.document, snapshot.title, false);
  }

  function undo() {
    const snapshot = past.at(-1);
    if (!snapshot) return;
    setPast((history) => history.slice(0, -1));
    restore(snapshot, "undo");
  }

  function redo() {
    const snapshot = future[0];
    if (!snapshot) return;
    setFuture((history) => history.slice(1));
    restore(snapshot, "redo");
  }

  return (
    <section className={`${styles.editor} ${className ?? ""}`} aria-label="Visual page editor">
      <header className={styles.topbar}>
        <label className={styles.titleField}>Page title<input aria-label="Page title" value={title} onChange={(event) => emit(draft, event.target.value)} /></label>
        <div className={styles.historyControls}>
          <button type="button" onClick={undo} disabled={!past.length} aria-label="Undo last change">↶ <span>Undo</span></button>
          <button type="button" onClick={redo} disabled={!future.length} aria-label="Redo last change">↷ <span>Redo</span></button>
        </div>
      </header>
      <div className={styles.workspace}>
        <nav className={styles.palette} aria-label="Add a block">
          <h2>Add a block</h2>
          {blockTypes.map((item) => <button key={item.type} type="button" onClick={() => addBlock(item.type)} disabled={draft.blocks.length >= 100}><span className={styles.paletteIcon}>{item.icon}</span><span>{item.label}</span><span className={styles.plus}>+</span></button>)}
        </nav>
        <main className={styles.stage}>
          <div className={styles.stageToolbar}>
            <div className={styles.modeControls} role="group" aria-label="Preview size">
              {(["desktop", "tablet", "mobile"] as PreviewMode[]).map((value) => <button key={value} type="button" aria-pressed={mode === value} className={mode === value ? styles.modeActive : ""} onClick={() => setMode(value)}><span aria-hidden="true">{value === "desktop" ? "▣" : value === "tablet" ? "▤" : "▯"}</span>{value}</button>)}
            </div>
          </div>
          <div className={styles.previewArea}>
            <div className={previewClass}>
              <div className={styles.siteHeader}><strong>Matthew Florek</strong><span>Work&nbsp;&nbsp; AI&nbsp;&nbsp; About&nbsp;&nbsp; Contact</span><button type="button" aria-label="Preview navigation menu">☰</button></div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={draft.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                  <div className={styles.canvas}>{draft.blocks.map((block) => <SortableBlock key={block.id} block={block} mode={mode} selected={block.id === selectedId} onSelect={() => setSelectedId(block.id)} onChange={(patch) => updateBlock(block.id, patch)} onDuplicate={() => duplicateBlock(block.id)} onDelete={() => deleteBlock(block.id)} />)}</div>
                </SortableContext>
              </DndContext>
              {!draft.blocks.length && <div className={styles.empty}><strong>Start building this page</strong><p>Add a block from the palette.</p></div>}
            </div>
          </div>
        </main>
        <div className={styles.inspectorPane}>{selected ? <Inspector block={selected} onChange={(patch) => updateBlock(selected.id, patch)} /> : <div className={styles.noSelection}><strong>Select a block</strong><p>Choose a block in the preview to edit it.</p></div>}</div>
      </div>
    </section>
  );
}
