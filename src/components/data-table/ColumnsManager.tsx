import { Settings2, GripVertical, RotateCcw } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { ColumnDef } from "./types";
import type { TableState } from "./useTablePrefs";

type Props<T> = {
  columns: ColumnDef<T>[];
  state: TableState;
  toggleVisible: (id: string) => void;
  reorder: (ids: string[]) => void;
  reset: () => void;
};

export function ColumnsManager<T>({
  columns,
  state,
  toggleVisible,
  reorder,
  reset,
}: Props<T>) {
  const ordered = [...state.columns].sort((a, b) => a.order - b.order);
  const byId = new Map(columns.map((c) => [c.id, c]));
  const items = ordered.map((c) => c.id).filter((id) => byId.has(id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.indexOf(String(active.id));
    const newIndex = items.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    reorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-1.5" />
          Colunas
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Arraste para reordenar
        </div>
        <Separator className="my-1" />
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <ul className="max-h-80 overflow-auto">
              {items.map((id) => {
                const def = byId.get(id)!;
                const colState = state.columns.find((c) => c.id === id)!;
                return (
                  <SortableItem
                    key={id}
                    id={id}
                    label={def.header}
                    visible={colState.visible}
                    onToggle={() => toggleVisible(id)}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
        <Separator className="my-1" />
        <div className="flex justify-end px-1 py-1">
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Restaurar padrão
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SortableItem({
  id,
  label,
  visible,
  onToggle,
}: {
  id: string;
  label: string;
  visible: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/60"
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground"
        {...attributes}
        {...listeners}
        aria-label="Reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox checked={visible} onCheckedChange={onToggle} id={`col-${id}`} />
      <label htmlFor={`col-${id}`} className="text-sm flex-1 cursor-pointer">
        {label}
      </label>
    </li>
  );
}
