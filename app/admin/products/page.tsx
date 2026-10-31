"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Product = {
  id: string;
  name: string;
  description: string;
  price_zar: number;
  image_url: string;
  type: string;
  active: boolean;
};

export default function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", description: "", price: "", type: "single" });
  const [file, setFile] = useState<File | null>(null);
  const [updatingImageId, setUpdatingImageId] = useState<string | null>(null);
  const router = useRouter();

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: true });
    if (data) setProducts(data);
    setLoading(false);
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push("/admin/login");
      else fetchProducts();
    };
    checkUser();
  }, [router]);

  const toggleActive = async (id: string, currentStatus: boolean) => {
    await supabase.from("products").update({ active: !currentStatus }).eq("id", id);
    fetchProducts();
  };

  const handleImageUpdate = async (productId: string, fileToUpload: File) => {
    setUpdatingImageId(productId);
    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, fileToUpload);
    if (uploadError) { alert("Error: " + uploadError.message); setUpdatingImageId(null); return; }

    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
    await supabase.from("products").update({ image_url: publicUrl }).eq("id", productId);
    
    setUpdatingImageId(null);
    fetchProducts();
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Please select an image");
    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file);
    if (uploadError) { alert("Error: " + uploadError.message); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
    const { error: dbError } = await supabase.from("products").insert({
      name: newProduct.name,
      description: newProduct.description,
      price_zar: parseFloat(newProduct.price),
      type: newProduct.type,
      image_url: publicUrl,
      active: true
    });

    if (dbError) alert("Error: " + dbError.message);
    else {
      setNewProduct({ name: "", description: "", price: "", type: "single" });
      setFile(null);
      fetchProducts();
    }
    setUploading(false);
  };

  if (loading) return <div style={{ padding: '2rem', fontFamily: 'serif' }}>Loading...</div>;

  return (
    <div style={{ backgroundColor: '#F3F4F6', minHeight: '100vh', padding: '2rem', fontFamily: 'sans-serif' }}>
      
      {/* We widen the container to 80rem so it can fit two columns side-by-side */}
      <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '1rem' }}>
          <h1 style={{ fontSize: '2rem', margin: 0, fontFamily: 'serif' }}>Pulp Admin</h1>
          <nav style={{ display: 'flex', gap: '1.5rem' }}>
            <a href="/admin" style={{ color: '#6B7280', textDecoration: 'none' }}>Orders</a>
            <span style={{ fontWeight: 'bold', borderBottom: '2px solid #111', paddingBottom: '0.25rem' }}>Products</span>
          </nav>
        </div>

        {/* The Grid Layout: 1 part left (Form), 2 parts right (List) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* LEFT COLUMN: Add Form */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #E5E7EB', height: 'fit-content' }}>
            <h2 style={{ fontSize: '1.25rem', fontFamily: 'serif', marginBottom: '1rem' }}>Add New Product</h2>
            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" placeholder="Name (e.g. Lemon)" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} style={{ padding: '0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem' }} />
              <textarea placeholder="Description" required value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} style={{ padding: '0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem', minHeight: '80px' }} />
              <input type="number" placeholder="Price (ZAR)" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} style={{ padding: '0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem' }} />
              <select value={newProduct.type} onChange={e => setNewProduct({...newProduct, type: e.target.value})} style={{ padding: '0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem' }}>
                <option value="single">Single Item</option>
                <option value="bundle">Bundle / Box</option>
              </select>
              <input type="file" accept="image/*" required onChange={e => setFile(e.target.files?.[0] || null)} style={{ fontSize: '0.875rem' }} />
              <button type="submit" disabled={uploading} style={{ backgroundColor: '#111111', color: '#FDF6E9', padding: '0.75rem', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: 'pointer', opacity: uploading ? 0.5 : 1 }}>
                {uploading ? "Uploading..." : "Add Product"}
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN: Current Menu List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontFamily: 'serif', marginBottom: '0.5rem' }}>Current Menu</h2>
            
            {/* Grid for the products inside the right column */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {products.map((p) => (
                <div key={p.id} style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '1rem', opacity: p.active ? 1 : 0.5 }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: '4rem' }}>
                    <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', backgroundColor: '#E5E7EB', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#6B7280' }}>
                      {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : "No Img"}
                    </div>
                    <label style={{ fontSize: '0.65rem', color: '#2563EB', cursor: 'pointer', fontWeight: 'bold' }}>
                      {updatingImageId === p.id ? "Uploading..." : "Change"}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpdate(p.id, f); }} />
                    </label>
                  </div>

                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold' }}>{p.name}</h3>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#6B7280' }}>R{p.price_zar}</p>
                  </div>

                  <button onClick={() => toggleActive(p.id, p.active)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', fontSize: '0.875rem', fontWeight: 'bold', cursor: 'pointer', backgroundColor: p.active ? '#FEE2E2' : '#D1FAE5', color: p.active ? '#991B1B' : '#065F46' }}>
                    {p.active ? "Disable" : "Enable"}
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}