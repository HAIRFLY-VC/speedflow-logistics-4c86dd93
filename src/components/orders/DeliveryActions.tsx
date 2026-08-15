import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Loader2, Camera, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/central/client";
import { supabase as storageClient } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OrderStatus } from "@/lib/orderStatus";

export function DeliveryActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [receivedBy, setReceivedBy] = useState("");
  const [document, setDocument] = useState("");
  const [notes, setNotes] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<HTMLInputElement>(null);

  const canDeliver =
    status === "em_transporte" &&
    (role === "adm" || role === "gestor" || role === "operador" || role === "fretista");

  const deliveryQ = useQuery({
    queryKey: ["orders", orderId, "delivery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*, delivery_receipts(*)")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const signedUrl = async (path: string) => {
    const { data } = await storageClient.storage
      .from("delivery-receipts")
      .createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  const receiptUrlsQ = useQuery({
    queryKey: ["orders", orderId, "delivery", "urls", deliveryQ.data?.id],
    enabled: !!deliveryQ.data?.delivery_receipts?.length,
    queryFn: async () => {
      const r = deliveryQ.data!.delivery_receipts![0];
      const [photo, sig] = await Promise.all([
        r.photo_url ? signedUrl(r.photo_url) : Promise.resolve(null),
        r.signature_url ? signedUrl(r.signature_url) : Promise.resolve(null),
      ]);
      return { photo, sig };
    },
  });

  const upload = async (file: File, kind: "photo" | "sig") => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user!.id}/${orderId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await storageClient.storage
      .from("delivery-receipts")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return path;
  };

  const deliver = useMutation({
    mutationFn: async () => {
      if (!receivedBy.trim()) throw new Error("Informe quem recebeu a entrega");
      const photoFile = photoRef.current?.files?.[0];
      const sigFile = signatureRef.current?.files?.[0];
      if (!photoFile && !sigFile) {
        throw new Error("Anexe ao menos uma foto ou assinatura como canhoto");
      }

      const photoPath = photoFile ? await upload(photoFile, "photo") : null;
      const sigPath = sigFile ? await upload(sigFile, "sig") : null;

      const { data: delivery, error: dErr } = await supabase
        .from("deliveries")
        .insert({
          order_id: orderId,
          delivered_at: new Date().toISOString(),
          received_by_name: receivedBy.trim(),
          received_by_document: document.trim() || null,
          notes: notes.trim() || null,
        })
        .select()
        .single();
      if (dErr) throw dErr;

      const { error: rErr } = await supabase.from("delivery_receipts").insert({
        delivery_id: delivery.id,
        photo_url: photoPath,
        signature_url: sigPath,
        uploaded_by: user!.id,
      });
      if (rErr) throw rErr;

      const { error: oErr } = await supabase
        .from("orders")
        .update({ status: "entregue" })
        .eq("id", orderId);
      if (oErr) throw oErr;
    },
    onSuccess: () => {
      toast.success("Entrega registrada");
      setOpen(false);
      setReceivedBy("");
      setDocument("");
      setNotes("");
      if (photoRef.current) photoRef.current.value = "";
      if (signatureRef.current) signatureRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (status !== "em_transporte" && status !== "entregue") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PackageCheck className="h-4 w-4" /> Entrega
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {deliveryQ.data ? (
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Entregue em: </span>
              {format(new Date(deliveryQ.data.delivered_at), "dd/MM/yyyy HH:mm", {
                locale: ptBR,
              })}
            </div>
            <div>
              <span className="text-muted-foreground">Recebido por: </span>
              {deliveryQ.data.received_by_name}
              {deliveryQ.data.received_by_document
                ? ` (${deliveryQ.data.received_by_document})`
                : ""}
            </div>
            {deliveryQ.data.notes ? (
              <div className="text-muted-foreground">{deliveryQ.data.notes}</div>
            ) : null}
            {receiptUrlsQ.data ? (
              <div className="flex gap-3 flex-wrap pt-2">
                {receiptUrlsQ.data.photo ? (
                  <a
                    href={receiptUrlsQ.data.photo}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <img
                      src={receiptUrlsQ.data.photo}
                      alt="Foto da entrega"
                      className="h-32 w-32 object-cover rounded border"
                    />
                    <div className="text-xs text-center mt-1">Foto</div>
                  </a>
                ) : null}
                {receiptUrlsQ.data.sig ? (
                  <a
                    href={receiptUrlsQ.data.sig}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <img
                      src={receiptUrlsQ.data.sig}
                      alt="Assinatura"
                      className="h-32 w-32 object-contain rounded border bg-white"
                    />
                    <div className="text-xs text-center mt-1">Assinatura</div>
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : canDeliver ? (
          <>
            <p className="text-sm text-muted-foreground">
              Registre a entrega anexando foto e/ou assinatura do canhoto.
            </p>
            <Button onClick={() => setOpen(true)}>
              <PackageCheck className="h-4 w-4 mr-2" /> Registrar entrega
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Aguardando entrega.</p>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar entrega</DialogTitle>
            <DialogDescription>
              Anexe canhoto (foto e/ou assinatura) e informe quem recebeu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="received_by">Recebido por *</Label>
              <Input
                id="received_by"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder="Nome de quem recebeu"
              />
            </div>
            <div>
              <Label htmlFor="document">Documento (CPF/RG)</Label>
              <Input
                id="document"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="photo" className="flex items-center gap-2">
                <Camera className="h-4 w-4" /> Foto do canhoto / entrega
              </Label>
              <Input
                id="photo"
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
              />
            </div>
            <div>
              <Label htmlFor="signature" className="flex items-center gap-2">
                <FileSignature className="h-4 w-4" /> Assinatura
              </Label>
              <Input
                id="signature"
                ref={signatureRef}
                type="file"
                accept="image/*"
              />
            </div>
            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => deliver.mutate()}
              disabled={deliver.isPending}
            >
              {deliver.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PackageCheck className="h-4 w-4 mr-2" />
              )}
              Confirmar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
