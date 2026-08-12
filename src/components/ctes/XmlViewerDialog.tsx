import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type XmlNode = {
  name: string;
  attrs: { name: string; value: string }[];
  text: string | null;
  children: XmlNode[];
};

function toNode(el: Element): XmlNode {
  const children = Array.from(el.children).map(toNode);
  const text = children.length === 0 ? (el.textContent?.trim() ?? "") : null;
  return {
    name: el.nodeName,
    attrs: Array.from(el.attributes).map((a) => ({ name: a.name, value: a.value })),
    text: text || null,
    children,
  };
}

function NodeView({ node, depth }: { node: XmlNode; depth: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
      <div className="hover:bg-muted/50 flex items-start gap-1 rounded py-0.5">
        <button
          type="button"
          onClick={() => hasChildren && setOpen((v) => !v)}
          className="text-muted-foreground mt-0.5 shrink-0"
          aria-label={open ? "Comprimir" : "Expandir"}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="inline-block h-3.5 w-3.5" />
          )}
        </button>
        <div className="font-mono text-xs leading-relaxed break-all">
          <span className="text-muted-foreground">&lt;</span>
          <span className="text-blue-600 dark:text-blue-400">{node.name}</span>
          {node.attrs.map((a) => (
            <span key={a.name}>
              {" "}
              <span className="text-amber-600 dark:text-amber-400">{a.name}</span>
              <span className="text-muted-foreground">=</span>
              <span className="text-emerald-600 dark:text-emerald-400">"{a.value}"</span>
            </span>
          ))}
          <span className="text-muted-foreground">&gt;</span>
          {!hasChildren && node.text ? (
            <>
              <span className="text-foreground">{node.text}</span>
              <span className="text-muted-foreground">&lt;/</span>
              <span className="text-blue-600 dark:text-blue-400">{node.name}</span>
              <span className="text-muted-foreground">&gt;</span>
            </>
          ) : null}
          {!hasChildren && !node.text ? null : null}
          {hasChildren && !open ? <span className="text-muted-foreground"> … </span> : null}
        </div>
      </div>
      {hasChildren && open ? (
        <div className="border-border/60 ml-[7px] border-l pl-2">
          {node.children.map((c, i) => (
            <NodeView key={`${c.name}-${i}`} node={c} depth={depth + 1} />
          ))}
          <div
            className="text-muted-foreground pl-[17px] font-mono text-xs"
            style={{ paddingLeft: 17 }}
          >
            &lt;/<span className="text-blue-600 dark:text-blue-400">{node.name}</span>&gt;
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function XmlViewerDialog({
  open,
  onOpenChange,
  xml,
  title,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  xml: string | null;
  title: string;
  loading?: boolean;
}) {
  const parsed = useMemo(() => {
    if (!xml) return null;
    try {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      if (doc.querySelector("parsererror") || !doc.documentElement) return null;
      return toNode(doc.documentElement);
    } catch {
      return null;
    }
  }, [xml]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-3 rounded-none p-6 sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="bg-muted/30 min-h-0 flex-1 overflow-auto rounded-md border p-3">
          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando XML…
            </div>
          ) : parsed ? (
            <NodeView node={parsed} depth={0} />
          ) : xml ? (
            <pre className="font-mono text-xs whitespace-pre-wrap">{xml}</pre>
          ) : (
            <p className="text-muted-foreground text-sm">XML não disponível.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
