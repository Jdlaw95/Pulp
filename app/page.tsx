"use client";

import { useState, useEffect } from "react";
import OrderModal from "./OrderModal";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Product = {
  id: string;
  name: string;
  description: string;
  price_zar: number;
  image_url: string;
  type: string;
};

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      // Fetch ALL active products (both singles and bundles)
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("active", true); 
        
      if (data) setProducts(data);
      setLoading(false);
    };
    fetchProducts();
  }, []);

  // Split the products into two lists for the UI
  const singles = products.filter((p) => p.type === "single");
  const bundles = products.filter((p) => p.type === "bundle");

  return (
    <div style={{ width: '100%', maxWidth: '450px', margin: '0 auto', padding: '3rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Logo Area */}
      <div style={{ width: '12rem', height: '12rem', borderRadius: '50%', border: '1px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem', position: 'relative' }}>
        <span style={{ fontSize: '3rem', letterSpacing: '0.1em', fontWeight: '500', fontFamily: 'sans-serif' }}>PULP</span>
        <span style={{ position: 'absolute', top: '2.5rem', right: '3rem', color: '#6B8E4E', fontSize: '1.25rem', transform: 'rotate(12deg)' }}>🍃</span>
      </div>

      {/* Title */}
      <h1 style={{ fontSize: '1.5rem', letterSpacing: '0.2em', marginBottom: '1.5rem', fontFamily: 'serif' }}>Illusion Collection</h1>
      <div style={{ width: '6rem', height: '1px', backgroundColor: '#111', marginBottom: '2.5rem' }}></div>

      {/* Single Products List */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '3rem' }}>
        {loading ? (
          <p style={{ textAlign: 'center', fontFamily: 'serif', color: '#6b7280' }}>Loading menu...</p>
        ) : (
          singles.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              
              <div style={{ width: '6rem', height: '6rem', borderRadius: '50%', backgroundColor: '#e5e7eb', overflow: 'hidden', flexShrink: 0, border: '1px solid #E5D9C5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.image_url ? (
                  <img 
                    src={p.image_url} 
                    alt={p.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>No Image</span>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', fontFamily: 'serif' }}>{p.name}:</h2>
                <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: '1.375', marginBottom: '0.5rem', fontFamily: 'serif' }}>{p.description}</p>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', fontFamily: 'serif' }}>R{p.price_zar} each</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dynamic Bundles Text */}
      {bundles.length > 0 && (
        <div style={{ textAlign: 'center', fontSize: '1.125rem', fontStyle: 'italic', marginBottom: '2rem', fontFamily: 'serif' }}>
          {bundles.map((b, index) => (
            <span key={b.id}>
              {b.name} - R{b.price_zar}
              {index < bundles.length - 1 && " | "}
            </span>
          ))}
        </div>
      )}

      {/* Button */}
      <button 
        onClick={() => setIsModalOpen(true)} 
        style={{ width: '100%', backgroundColor: '#111111', color: '#FDF6E9', padding: '1rem 0', borderRadius: '9999px', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.875rem', cursor: 'pointer', border: 'none', fontFamily: 'sans-serif' }}
      >
        Order Now
      </button>

      {/* Footer */}
      <div style={{ marginTop: '3rem', textAlign: 'center', fontSize: '0.875rem', fontFamily: 'serif' }}>
        <p>pulpfruitscpt@gmail.com</p>
        <p>WhatsApp: 0720301273</p>
      </div>

      <OrderModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        products={singles} 
      />

    </div>
  );
}