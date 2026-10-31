"use client";

import { useState, useEffect } from "react";
import { submitOrder } from "./actions";
import { Product } from "./page";

export default function OrderModal({ 
  isOpen, 
  onClose, 
  products 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  products: Product[] 
}) {
  const [orderMode, setOrderMode] = useState<"Trio" | "Box of 6" | "Custom">("Trio");
  const [flavors, setFlavors] = useState<Record<string, number>>({});
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const initial: Record<string, number> = {};
    products.forEach(p => initial[p.id] = 0);
    setFlavors(initial);
    setErrorMsg("");
  }, [orderMode, products]);

  if (!isOpen) return null;

  const totalSelected = Object.values(flavors).reduce((a, b) => a + b, 0);
  const maxAllowed = orderMode === "Trio" ? 3 : orderMode === "Box of 6" ? 6 : 99; 
  const remaining = maxAllowed - totalSelected;

  let finalPrice = 0;
  if (orderMode === "Trio") {
    finalPrice = 75;
  } else if (orderMode === "Box of 6") {
    finalPrice = 150;
  } else {
    const setsOf6 = Math.floor(totalSelected / 6);
    const remainder = totalSelected % 6;
    const setsOf3 = Math.floor(remainder / 3);
    const singles = remainder % 3;
    finalPrice = (setsOf6 * 150) + (setsOf3 * 75) + (singles * 28);
  }

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 2);
  const minDateString = minDate.toISOString().split("T")[0];

  const updateFlavor = (productId: string, change: number) => {
    const newTotal = totalSelected + change;
    if (newTotal < 0 || newTotal > maxAllowed) return;
    
    setFlavors(prev => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] || 0) + change)
    }));
    setErrorMsg(""); 
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (orderMode !== "Custom" && totalSelected !== maxAllowed) {
      setErrorMsg(`Please select exactly ${maxAllowed} flavors.`);
      return;
    }

    if (orderMode === "Custom" && totalSelected === 0) {
      setErrorMsg("Please select at least 1 item.");
      return;
    }

    const readableFlavors: Record<string, number> = {};
    products.forEach(p => {
      if (flavors[p.id] > 0) readableFlavors[p.name] = flavors[p.id];
    });

    setLoading(true);
    const result = await submitOrder({
      name, email, phone, date, 
      boxType: orderMode === "Custom" ? "Box of 6" : orderMode, 
      total: finalPrice,
      flavors: readableFlavors 
    });

    setLoading(false);

    if (result.success) {
      setSuccess(true);
    } else {
      setErrorMsg(result.error || "Something went wrong.");
    }
  };

  const handleClose = () => {
    setSuccess(false);
    const reset: Record<string, number> = {};
    products.forEach(p => reset[p.id] = 0);
    setFlavors(reset);
    setName(""); setEmail(""); setPhone(""); setDate("");
    onClose();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ backgroundColor: '#FDF6E9', width: '100%', maxWidth: '28rem', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
        
        {success ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <h2 style={{ fontSize: '2rem', fontFamily: 'serif', marginBottom: '1rem' }}>Order Received!</h2>
            <p style={{ fontFamily: 'serif', marginBottom: '1.5rem', color: '#374151' }}>
              Please check your email. We have sent the banking details and your unique payment reference to confirm your order.
            </p>
            <button onClick={handleClose} style={{ backgroundColor: '#111111', color: '#FDF6E9', padding: '0.75rem 2rem', borderRadius: '999px', border: 'none', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.875rem', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontFamily: 'serif', margin: 0 }}>Place Order</h2>
              <button type="button" onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#6B7280', cursor: 'pointer' }}>&times;</button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>How would you like to order?</label>
              <select 
                value={orderMode} 
                onChange={(e) => setOrderMode(e.target.value as any)}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #E5D9C5', borderRadius: '0.5rem', backgroundColor: 'white', fontSize: '1rem' }}
              >
                <option value="Trio">Trio Box (Any 3) - R75</option>
                <option value="Box of 6">Box of 6 (Any 6) - R150</option>
                <option value="Custom">Custom Selection (Singles)</option>
              </select>
            </div>

            <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #E5D9C5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: '500', margin: 0 }}>Choose Flavors</p>
                {orderMode !== "Custom" ? (
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '999px', backgroundColor: remaining === 0 ? '#D1FAE5' : '#FEF3C7', color: remaining === 0 ? '#065F46' : '#92400E' }}>
                    {remaining === 0 ? "Perfect!" : `${remaining} remaining`}
                  </span>
                ) : totalSelected > 0 && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '999px', backgroundColor: '#D1FAE5', color: '#065F46' }}>
                    {totalSelected} items
                  </span>
                )}
              </div>
              
              {products.map((product) => (
                <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontFamily: 'serif', fontSize: '1rem' }}>{product.name} <span style={{ fontSize: '0.75rem', color: '#6B7280', marginLeft: '0.25rem' }}>(R{product.price_zar})</span></span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button 
                      type="button" 
                      onClick={() => updateFlavor(product.id, -1)} 
                      disabled={!flavors[product.id]}
                      style={{ width: '2rem', height: '2rem', borderRadius: '50%', border: '1px solid #D1D5DB', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: flavors[product.id] ? 'pointer' : 'not-allowed', opacity: flavors[product.id] ? 1 : 0.3 }}
                    >
                      -
                    </button>
                    <span style={{ width: '1rem', textAlign: 'center', fontWeight: '500' }}>{flavors[product.id] || 0}</span>
                    <button 
                      type="button" 
                      onClick={() => updateFlavor(product.id, 1)} 
                      disabled={remaining === 0}
                      style={{ width: '2rem', height: '2rem', borderRadius: '50%', border: '1px solid #D1D5DB', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: remaining === 0 ? 'not-allowed' : 'pointer', opacity: remaining === 0 ? 0.3 : 1 }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* THE UPSELL NUDGE */}
            {orderMode === "Custom" && totalSelected === 2 && (
              <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #10B981', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1.25rem' }}>💡</span>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#065F46', lineHeight: '1.4' }}>
                  <strong>Sweet tip:</strong> Add 1 more fruit to get the Trio Box for R75 (save R9)!
                </p>
              </div>
            )}

            <input type="text" placeholder="Full Name" required value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #E5D9C5', borderRadius: '0.5rem', backgroundColor: 'white' }} />
            <input type="email" placeholder="Email Address" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #E5D9C5', borderRadius: '0.5rem', backgroundColor: 'white' }} />
            <input type="tel" placeholder="WhatsApp Number" required value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #E5D9C5', borderRadius: '0.5rem', backgroundColor: 'white' }} />
            
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>When do you need it?</label>
              <input 
                type="date" 
                required 
                min={minDateString} 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #E5D9C5', borderRadius: '0.5rem', backgroundColor: 'white' }} 
              />
              <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>Minimum 48 hours notice required.</p>
            </div>

            {errorMsg && <p style={{ color: '#EF4444', fontSize: '0.875rem', fontWeight: '500', margin: 0 }}>{errorMsg}</p>}

            <button 
              type="submit" 
              disabled={loading || (orderMode !== "Custom" && totalSelected !== maxAllowed) || (orderMode === "Custom" && totalSelected === 0)} 
              style={{ width: '100%', backgroundColor: '#111111', color: '#FDF6E9', padding: '1rem', borderRadius: '999px', border: 'none', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.875rem', marginTop: '0.5rem', cursor: (loading || (orderMode !== "Custom" && totalSelected !== maxAllowed) || (orderMode === "Custom" && totalSelected === 0)) ? 'not-allowed' : 'pointer', opacity: (loading || (orderMode !== "Custom" && totalSelected !== maxAllowed) || (orderMode === "Custom" && totalSelected === 0)) ? 0.5 : 1 }}
            >
              {loading ? "Processing..." : `Confirm Order - R${finalPrice}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}