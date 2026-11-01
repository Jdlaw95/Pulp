"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { browserDb } from "../../../lib/supabase-browser";
import { createProduct, getUploadUrl, setProductImage, toggleProduct, updateProduct } from "../../actions";
import type { Product } from "../../../lib/types";
import { packSize as getPack, priceLabel } from "../../../lib/pricing";

function SoldAs({ pack, setPack }: { pack: number; setPack: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <select aria-label="Sold as" className={field + " !w-auto"} value={pack > 1 ? "pack" : "each"} onChange={(e) => setPack(e.target.value === "pack" ? Math.max(2, pack) : 1)}>
        <option value="each">Each</option>
        <option value="pack">Pack of…</option>
      </select>
      {pack > 1 && <input aria-label="Pieces in the pack" type="number" min={2} max={12} className={field + " !w-20"} value={pack} onChange={(e) => setPack(Math.round(Number(e.target.value)) || 2)} />}
    </div>
  );
}

const field = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";

async function uploadImage(file: File): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (file.size > 10 * 1024 * 1024) return { ok: false, message: "Image is over 10 MB." };
  const ext = file.name.split(".").pop() ?? "jpg";
  const t = await getUploadUrl(ext);
  if (!t.ok) return t;
  const { error } = await browserDb().storage.from("product-images").uploadToSignedUrl(t.path, t.token, file);
  if (error) return { ok: false, message: error.message };
  return { ok: true, url: t.publicUrl };
}

function ProductRow({ p }: { p: Product }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [description, setDescription] = useState(p.description);
  const [price, setPrice] = useState(String(p.price_zar));
  const [pack, setPack] = useState(getPack(p));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();

  const run = async (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    setMsg("");
    const r = await fn();
    setBusy(false);
    if (!r.ok) setMsg(r.message ?? "Something went wrong");
    else start(() => router.refresh());
    return r.ok;
  };

  const changeImage = (file: File) =>
    run(async () => {
      const up = await uploadImage(file);
      if (!up.ok) return up;
      return setProductImage(p.id, up.url);
    });

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 ${p.active ? "" : "opacity-60"}`}>
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-1">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-gray-200">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
            ) : <div className="flex h-full items-center justify-center text-[10px] text-gray-500">No image</div>}
          </div>
          <label className="cursor-pointer text-xs font-bold text-blue-600">
            {busy ? "Working…" : "Change"}
            <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) changeImage(f); }} />
          </label>
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
              <textarea className={field} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">R</span>
                <input aria-label="Price in rand" type="number" min={1} step="0.01" className={field + " !w-24"} value={price} onChange={(e) => setPrice(e.target.value)} />
                <SoldAs pack={pack} setPack={setPack} />
              </div>
              <p className="text-xs text-gray-500">Shown to customers as <strong>{priceLabel({ price_zar: Number(price) || 0, pack_size: pack })}</strong></p>
              <div className="flex gap-2">
                <button disabled={busy} onClick={async () => (await run(() => updateProduct(p.id, name, description, Number(price), pack))) && setEditing(false)} className="rounded-lg bg-pulp-text px-3 py-1.5 text-sm text-white">Save</button>
                <button onClick={() => { setEditing(false); setName(p.name); setDescription(p.description); setPrice(String(p.price_zar)); setPack(getPack(p)); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="font-semibold">{p.name}</h3>
              <p className="text-sm text-gray-600">{p.description}</p>
              <p className="mt-1 text-sm font-medium">{priceLabel(p)}</p>
            </>
          )}
          {msg && <p role="alert" className="mt-1 text-sm text-red-600">{msg}</p>}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {!editing && <button onClick={() => setEditing(true)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Edit</button>}
          <button disabled={busy} onClick={() => run(() => toggleProduct(p.id, !p.active))} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${p.active ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
            {p.active ? "Hide" : "Show"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsManager({ products }: { products: Product[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("28");
  const [pack, setPack] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setMsg("Please choose a photo.");
    setBusy(true);
    setMsg("");
    const up = await uploadImage(file);
    if (!up.ok) { setBusy(false); return setMsg(up.message); }
    const r = await createProduct(name, description, up.url, Number(price), pack);
    setBusy(false);
    if (!r.ok) return setMsg(r.message ?? "Could not add product");
    setName(""); setDescription(""); setFile(null); setPrice("28"); setPack(1);
    (document.getElementById("new-product-file") as HTMLInputElement | null)?.setAttribute("value", "");
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <form onSubmit={add} className="h-fit space-y-3 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-serif text-xl">Add a flavour</h2>
        <input className={field} placeholder="Name (e.g. Lemon)" required value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className={field} rows={3} placeholder="Description" required value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">R</span>
          <input aria-label="Price in rand" type="number" min={1} step="0.01" required className={field + " !w-24"} value={price} onChange={(e) => setPrice(e.target.value)} />
          <SoldAs pack={pack} setPack={setPack} />
        </div>
        <input id="new-product-file" type="file" accept="image/*" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        {msg && <p role="alert" className="text-sm text-red-600">{msg}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-pulp-text py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Uploading…" : "Add flavour"}</button>
      </form>

      <div className="space-y-3">
        {products.length === 0 && <p className="text-sm text-gray-500">No flavours yet.</p>}
        {products.map((p) => <ProductRow key={p.id} p={p} />)}
      </div>
    </div>
  );
}
